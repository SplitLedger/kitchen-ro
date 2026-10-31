import { and, asc, eq } from "drizzle-orm";
import type { FoodStat } from "@/domain/catalog/food-stat";
import { parseMastery, parseStat, resolveDefaultKit } from "@/domain/cooking/profile";
import { allocateFifo } from "@/domain/inventory/allocate";
import {
  isPriceBasis,
  lookupSummary,
  unitPriceForBasis,
  type PriceBasis,
  type PriceBook,
} from "@/domain/inventory/prices";
import {
  assertOrderQuantity,
  isOrderPlanningMode,
  OrderPlanError,
  planOrder,
  summarize,
  type OrderPlan,
  type OrderPlanningMode,
  type PlanKit,
  type PlanLine,
  type PlanLineInput,
  type PlanMaterial,
  type PlanRecipe,
} from "@/domain/orders/plan";
import { isCertainSuccess } from "@/domain/cooking/success";
import { parseMarginPercent } from "@/domain/pricing/cost";
import {
  getCatalogRecipe,
  listCatalogRecipes,
  listCookingKits,
  type CatalogKit,
  type CatalogRecipe,
} from "./catalog";
import type { KitchenDatabase } from "./client";
import { loadPriceBook } from "./inventory";
import {
  inventoryLots,
  orderAllocations,
  orderLines,
  orderMaterials,
  orders,
  type InventoryLot,
  type Order,
  type OrderLine,
  type OrderMaterial,
  type Settings,
} from "./schema";

const maxCustomerName = 80;
const maxNotes = 1000;
const maxSale = 999_999_999;

export class OrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderError";
  }
}

export type OrderHeaderDraft = {
  customerName: string;
  notes: string;
  baseLevel: number;
  dex: number;
  luk: number;
  mastery: number;
  marginPercent: number;
};

export type OrderLineView = {
  lineId: number;
  recipeId: number | null;
  quantity: number;
  saleOverride: number | null;
  fallbackName: string;
  kitOverride: boolean;
  kitId: number | null;
  kitName: string;
  plan: PlanLine | null;
};

export type PickerRecipe = {
  id: number;
  name: string;
  stat: FoodStat;
  level: number;
};

export type PickerKit = {
  id: number;
  name: string;
  archived: boolean;
};

export type OrderDetail = {
  order: Order;
  lines: OrderLineView[];
  plan: OrderPlan;
  pickerRecipes: PickerRecipe[];
  pickerKits: PickerKit[];
};

export type OrderSummary = {
  id: number;
  customerName: string;
  status: Order["status"];
  planningMode: OrderPlanningMode;
  createdAt: string;
  updatedAt: string;
  lineCount: number;
  saleTotal: number | null;
};

export function parseCustomerName(value: string): string {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length > maxCustomerName) {
    throw new OrderError(`Customer name must be ${maxCustomerName} characters or fewer.`);
  }
  return name;
}

export function parseOrderNotes(value: string): string {
  const notes = value.trim();
  if (notes.length > maxNotes) {
    throw new OrderError(`Notes must be ${maxNotes} characters or fewer.`);
  }
  return notes;
}

export async function listOrderSummaries(db: KitchenDatabase): Promise<OrderSummary[]> {
  const rows = await db.select().from(orders).orderBy(asc(orders.createdAt), asc(orders.id));
  if (rows.length === 0) {
    return [];
  }
  const context = await loadOrderContext(db);
  return rows.map((order) => {
    const detail = buildOrderDetail(order, context);
    return {
      id: order.id,
      customerName: order.customerName,
      status: order.status,
      planningMode: order.planningMode,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      lineCount: detail.lines.length,
      saleTotal: detail.plan.saleTotal,
    };
  });
}

export async function createDraftOrder(db: KitchenDatabase, settings: Settings): Promise<number> {
  const kits = await listCookingKits(db);
  const kit = resolveDefaultKit(kits, settings.defaultKitKey);
  if (!kit) {
    throw new OrderError("Choose a default kit in Settings before starting an order.");
  }
  if (!isOrderPlanningMode(settings.planningMode)) {
    throw new OrderError("Choose Expected or Conservative.");
  }
  if (!isPriceBasis(settings.priceBasis)) {
    throw new OrderError("Choose a minimum, average, or maximum price.");
  }
  const now = timestamp();
  const [created] = await db
    .insert(orders)
    .values({
      customerName: "",
      notes: "",
      status: "draft",
      planningMode: settings.planningMode,
      priceBasis: settings.priceBasis,
      kitId: kit.id,
      kitName: kit.name,
      produceValue: kit.produceValue,
      alwaysSuccess: kit.alwaysSuccess,
      baseLevel: settings.baseLevel,
      dex: settings.dex,
      luk: settings.luk,
      mastery: settings.mastery,
      marginPercent: settings.marginPercent,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: orders.id });
  if (!created) {
    throw new OrderError("Could not start the order.");
  }
  return created.id;
}

export async function getOrderDetail(
  db: KitchenDatabase,
  orderId: number,
): Promise<OrderDetail | null> {
  const order = await findOrder(db, orderId);
  if (!order) {
    return null;
  }
  const context = await loadOrderContext(db);
  return buildOrderDetail(order, context);
}

export async function updateOrderHeader(
  db: KitchenDatabase,
  orderId: number,
  draft: OrderHeaderDraft,
): Promise<void> {
  await requireDraft(db, orderId);
  const customerName = parseCustomerName(draft.customerName);
  const notes = parseOrderNotes(draft.notes);
  await db
    .update(orders)
    .set({
      customerName,
      notes,
      baseLevel: parseStat(String(draft.baseLevel), "Base level"),
      dex: parseStat(String(draft.dex), "DEX"),
      luk: parseStat(String(draft.luk), "LUK"),
      mastery: parseMastery(String(draft.mastery)),
      marginPercent: parseMarginPercent(String(draft.marginPercent)),
      updatedAt: timestamp(),
    })
    .where(eq(orders.id, orderId));
}

export async function updateOrderPlanningMode(
  db: KitchenDatabase,
  orderId: number,
  planningMode: OrderPlanningMode,
): Promise<void> {
  await requireDraft(db, orderId);
  if (!isOrderPlanningMode(planningMode)) {
    throw new OrderError("Choose Expected or Conservative.");
  }
  await db
    .update(orders)
    .set({ planningMode, updatedAt: timestamp() })
    .where(eq(orders.id, orderId));
}

export async function updateOrderPriceBasis(
  db: KitchenDatabase,
  orderId: number,
  priceBasis: PriceBasis,
): Promise<void> {
  await requireDraft(db, orderId);
  if (!isPriceBasis(priceBasis)) {
    throw new OrderError("Choose a minimum, average, or maximum price.");
  }
  await db.update(orders).set({ priceBasis, updatedAt: timestamp() }).where(eq(orders.id, orderId));
}

export async function updateOrderKit(
  db: KitchenDatabase,
  orderId: number,
  kitId: number,
): Promise<void> {
  await requireDraft(db, orderId);
  const kits = await listCookingKits(db, { includeArchived: true });
  const kit = kits.find((item) => item.id === kitId);
  if (!kit) {
    throw new OrderError("Choose a cooking kit.");
  }
  await db
    .update(orders)
    .set({
      kitId: kit.id,
      kitName: kit.name,
      produceValue: kit.produceValue,
      alwaysSuccess: kit.alwaysSuccess,
      updatedAt: timestamp(),
    })
    .where(eq(orders.id, orderId));
}

export async function addOrderRecipe(
  db: KitchenDatabase,
  orderId: number,
  recipeId: number,
): Promise<void> {
  await requireDraft(db, orderId);
  const recipe = await getCatalogRecipe(db, recipeId);
  if (!recipe) {
    throw new OrderError("That dish is not in the catalog.");
  }
  if (recipe.archived) {
    throw new OrderError("Unarchive this dish before adding it to an order.");
  }
  const lines = await linesForOrder(db, orderId);
  const existing = lines.find((line) => line.recipeId === recipeId);
  if (existing) {
    let quantity = existing.quantity + 1;
    try {
      quantity = assertOrderQuantity(quantity);
    } catch (error) {
      throw asOrderError(error);
    }
    await db
      .update(orderLines)
      .set({
        quantity,
        name: recipe.name,
        stat: recipe.stat,
        level: recipe.level,
        ingredientCount: recipe.items.length,
      })
      .where(eq(orderLines.id, existing.id));
  } else {
    const position = lines.reduce((max, line) => Math.max(max, line.position), -1) + 1;
    await db.insert(orderLines).values({
      orderId,
      recipeId: recipe.id,
      position,
      name: recipe.name,
      stat: recipe.stat,
      level: recipe.level,
      ingredientCount: recipe.items.length,
      quantity: 1,
      kitId: null,
      kitOverride: false,
    });
  }
  await touchOrder(db, orderId);
}

export async function setOrderLineKit(
  db: KitchenDatabase,
  orderId: number,
  lineId: number,
  kitId: number | null,
): Promise<void> {
  await requireDraft(db, orderId);
  const [line] = await db
    .select()
    .from(orderLines)
    .where(and(eq(orderLines.id, lineId), eq(orderLines.orderId, orderId)));
  if (!line) {
    throw new OrderError("That line is not on this order.");
  }
  if (kitId === null) {
    await db
      .update(orderLines)
      .set({ kitId: null, kitOverride: false })
      .where(eq(orderLines.id, lineId));
  } else {
    const kits = await listCookingKits(db, { includeArchived: true });
    const kit = kits.find((item) => item.id === kitId);
    if (!kit) {
      throw new OrderError("Choose a cooking kit.");
    }
    await db
      .update(orderLines)
      .set({ kitId: kit.id, kitOverride: true })
      .where(eq(orderLines.id, lineId));
  }
  await touchOrder(db, orderId);
}

export async function setOrderLineQuantity(
  db: KitchenDatabase,
  orderId: number,
  lineId: number,
  quantity: number,
): Promise<void> {
  await requireDraft(db, orderId);
  let next = quantity;
  try {
    next = assertOrderQuantity(quantity);
  } catch (error) {
    throw asOrderError(error);
  }
  const [line] = await db
    .select()
    .from(orderLines)
    .where(and(eq(orderLines.id, lineId), eq(orderLines.orderId, orderId)));
  if (!line) {
    throw new OrderError("That line is not on this order.");
  }
  await db.update(orderLines).set({ quantity: next }).where(eq(orderLines.id, lineId));
  await touchOrder(db, orderId);
}

export async function setOrderLineSale(
  db: KitchenDatabase,
  orderId: number,
  lineId: number,
  saleOverride: number | null,
): Promise<void> {
  await requireDraft(db, orderId);
  if (
    saleOverride !== null &&
    (!Number.isSafeInteger(saleOverride) || saleOverride < 0 || saleOverride > maxSale)
  ) {
    throw new OrderError(
      saleOverride > maxSale ? "Sale price is too large." : "Sale price must be a whole number.",
    );
  }
  const [line] = await db
    .select()
    .from(orderLines)
    .where(and(eq(orderLines.id, lineId), eq(orderLines.orderId, orderId)));
  if (!line) {
    throw new OrderError("That line is not on this order.");
  }
  await db.update(orderLines).set({ saleOverride }).where(eq(orderLines.id, lineId));
  await touchOrder(db, orderId);
}

export async function removeOrderLine(
  db: KitchenDatabase,
  orderId: number,
  lineId: number,
): Promise<void> {
  await requireDraft(db, orderId);
  const [line] = await db
    .select({ id: orderLines.id })
    .from(orderLines)
    .where(and(eq(orderLines.id, lineId), eq(orderLines.orderId, orderId)));
  if (!line) {
    throw new OrderError("That line is not on this order.");
  }
  await db.delete(orderLines).where(eq(orderLines.id, lineId));
  await touchOrder(db, orderId);
}

export async function confirmOrder(db: KitchenDatabase, orderId: number): Promise<void> {
  const detail = await getOrderDetail(db, orderId);
  if (!detail) {
    throw new OrderError("This order was not found.");
  }
  if (detail.order.status !== "draft") {
    throw new OrderError("This order is no longer a draft, so it cannot be changed.");
  }
  if (detail.plan.blockers.length > 0) {
    throw new OrderError(detail.plan.blockers.join(" "));
  }
  const catalogKits = await listCookingKits(db, { includeArchived: true });
  const orderKit = detail.order.kitId
    ? catalogKits.find((item) => item.id === detail.order.kitId)
    : undefined;
  if (!orderKit) {
    throw new OrderError(
      "Choose a cooking kit. The kit on this order is no longer in the catalog.",
    );
  }

  const now = timestamp();
  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status: "confirmed",
        confirmedAt: now,
        updatedAt: now,
        kitId: orderKit.id,
        kitName: orderKit.name,
        produceValue: orderKit.produceValue,
        alwaysSuccess: orderKit.alwaysSuccess,
      })
      .where(eq(orders.id, orderId));

    for (const line of detail.lines) {
      const plan = line.plan;
      if (
        !plan ||
        plan.usedRateBp === null ||
        plan.attempts === null ||
        plan.unitCost === null ||
        plan.unitSale === null ||
        plan.saleSource === null ||
        plan.oneAttemptCost === null
      ) {
        throw new OrderError("This order is missing a price or a success rate.");
      }
      const lineKit = line.kitOverride
        ? catalogKits.find((item) => item.id === line.kitId)
        : orderKit;
      if (!lineKit) {
        throw new OrderError(
          `Choose a cooking kit for ${plan.name}. The kit on this dish is no longer in the catalog.`,
        );
      }
      await tx
        .update(orderLines)
        .set({
          name: plan.name,
          stat: plan.stat,
          level: plan.level,
          ingredientCount: plan.ingredientRowCount,
          quantity: plan.quantity,
          minRateBp: plan.minRateBp,
          avgRateBp: plan.avgRateBp,
          maxRateBp: plan.maxRateBp,
          usedRateBp: plan.usedRateBp,
          attempts: plan.attempts,
          oneAttemptCost: plan.oneAttemptCost,
          unitCost: plan.unitCost,
          unitSale: plan.unitSale,
          saleSource: plan.saleSource,
          saleOverride: plan.saleOverride,
          kitName: lineKit.name,
          alwaysSuccess: lineKit.alwaysSuccess,
        })
        .where(and(eq(orderLines.id, line.lineId), eq(orderLines.orderId, orderId)));
    }

    await tx.delete(orderMaterials).where(eq(orderMaterials.orderId, orderId));
    if (detail.plan.materials.length > 0) {
      await tx.insert(orderMaterials).values(
        detail.plan.materials.map((material, position) => ({
          orderId,
          position,
          kind: material.kind,
          ingredientId: material.ingredientId,
          kitId: material.kitId,
          name: material.name,
          quantity: material.quantity,
          unitValue: material.unitValue,
          extendedCost: material.extendedCost,
        })),
      );
    }
    await deductStock(tx, orderId, detail.plan.materials);
  });
}

export async function markOrderDone(db: KitchenDatabase, orderId: number): Promise<void> {
  await requireStatus(db, orderId, ["confirmed"], "Only a confirmed order can be marked done.");
  await db
    .update(orders)
    .set({ status: "done", updatedAt: timestamp() })
    .where(eq(orders.id, orderId));
}

export async function cancelOrder(db: KitchenDatabase, orderId: number): Promise<void> {
  await requireStatus(db, orderId, ["confirmed"], "Only a confirmed order can be cancelled.");
  const now = timestamp();
  await db.transaction(async (tx) => {
    await restoreAllocations(tx, orderId);
    await tx
      .update(orders)
      .set({ status: "cancelled", updatedAt: now })
      .where(eq(orders.id, orderId));
  });
}

export async function reopenOrder(db: KitchenDatabase, orderId: number): Promise<void> {
  await requireStatus(
    db,
    orderId,
    ["confirmed", "done", "cancelled"],
    "Reopen a confirmed, done, or cancelled order.",
  );
  const now = timestamp();
  await db.transaction(async (tx) => {
    await restoreAllocations(tx, orderId);
    await tx
      .update(orders)
      .set({ status: "draft", confirmedAt: null, updatedAt: now })
      .where(eq(orders.id, orderId));
    await tx
      .update(orderLines)
      .set({
        minRateBp: null,
        avgRateBp: null,
        maxRateBp: null,
        usedRateBp: null,
        attempts: null,
        oneAttemptCost: null,
        unitCost: null,
        unitSale: null,
        saleSource: null,
        kitName: null,
        alwaysSuccess: null,
      })
      .where(eq(orderLines.orderId, orderId));
    await tx.delete(orderMaterials).where(eq(orderMaterials.orderId, orderId));
  });
}

export async function deleteDraftOrder(db: KitchenDatabase, orderId: number): Promise<void> {
  await requireDraft(db, orderId);
  await db.delete(orders).where(eq(orders.id, orderId));
}

type OrderContext = {
  lines: OrderLine[];
  materials: OrderMaterial[];
  recipes: CatalogRecipe[];
  kits: CatalogKit[];
  prices: PriceBook;
};

async function loadOrderContext(db: KitchenDatabase): Promise<OrderContext> {
  const [lines, materials, recipes, kits, prices] = await Promise.all([
    db.select().from(orderLines),
    db.select().from(orderMaterials),
    listCatalogRecipes(db, { includeArchived: true }),
    listCookingKits(db, { includeArchived: true }),
    loadPriceBook(db),
  ]);
  return { lines, materials, recipes, kits, prices };
}

function buildOrderDetail(order: Order, context: OrderContext): OrderDetail {
  const lines = context.lines
    .filter((line) => line.orderId === order.id)
    .sort((left, right) => left.position - right.position || left.id - right.id);
  const materials = context.materials
    .filter((material) => material.orderId === order.id)
    .sort((left, right) => left.position - right.position || left.id - right.id);
  const recipesById = new Map(context.recipes.map((recipe) => [recipe.id, recipe]));
  const built =
    order.status === "draft"
      ? buildDraft(order, lines, recipesById, context.kits, context.prices)
      : buildSnapshot(order, lines, materials);

  const referencedKitIds = new Set<number>();
  if (order.kitId !== null) {
    referencedKitIds.add(order.kitId);
  }
  for (const line of lines) {
    if (line.kitId !== null) {
      referencedKitIds.add(line.kitId);
    }
  }
  const pickerKits = context.kits
    .filter((kit) => !kit.archived || referencedKitIds.has(kit.id))
    .map((kit) => ({ id: kit.id, name: kit.name, archived: kit.archived }));

  return {
    order,
    lines: built.lines,
    plan: built.plan,
    pickerRecipes: context.recipes
      .filter((recipe) => !recipe.archived)
      .map((recipe) => ({
        id: recipe.id,
        name: recipe.name,
        stat: recipe.stat,
        level: recipe.level,
      })),
    pickerKits,
  };
}

function buildDraft(
  order: Order,
  lines: readonly OrderLine[],
  recipesById: Map<number, CatalogRecipe>,
  kits: readonly CatalogKit[],
  prices: PriceBook,
): { lines: OrderLineView[]; plan: OrderPlan } {
  const kitRow = order.kitId ? kits.find((kit) => kit.id === order.kitId) : undefined;
  const orderKit = toPlanKit(order, kitRow, prices);
  const inputs: PlanLineInput[] = [];
  const removed: string[] = [];
  const resolvedKits = new Map<number, PlanKit>();

  for (const line of lines) {
    const resolved = resolveLineKit(order, line, kits, prices, orderKit);
    resolvedKits.set(line.id, resolved);
    const recipe = line.recipeId ? recipesById.get(line.recipeId) : undefined;
    if (!recipe) {
      removed.push(
        `${line.name || "A dish"} is no longer in the catalog. Remove that line before confirming.`,
      );
      continue;
    }
    inputs.push({
      recipe: toPlanRecipe(recipe, prices, order.priceBasis),
      quantity: line.quantity,
      saleOverride: line.saleOverride,
      kit: resolved,
      kitOverride: line.kitOverride,
    });
  }

  const plan = withStock(
    planOrder({
      mode: order.planningMode,
      cook: {
        baseLevel: order.baseLevel,
        dex: order.dex,
        luk: order.luk,
        mastery: order.mastery,
      },
      kit: orderKit,
      marginPercent: order.marginPercent,
      lines: inputs,
    }),
    prices,
  );
  const planByRecipe = new Map(plan.lines.map((line) => [line.recipeId, line]));
  return {
    plan: {
      ...plan,
      blockers: [...removed, ...plan.blockers],
    },
    lines: lines.map((line) => ({
      lineId: line.id,
      recipeId: line.recipeId,
      quantity: line.quantity,
      saleOverride: line.saleOverride,
      fallbackName: line.name,
      kitOverride: line.kitOverride,
      kitId: line.kitId,
      kitName: resolvedKits.get(line.id)?.name ?? order.kitName,
      plan: line.recipeId ? (planByRecipe.get(line.recipeId) ?? null) : null,
    })),
  };
}

function buildSnapshot(
  order: Order,
  lines: readonly OrderLine[],
  materials: readonly OrderMaterial[],
): { lines: OrderLineView[]; plan: OrderPlan } {
  const planned = lines.map(lineFromSnapshot);
  const certainSuccess =
    lines.length === 0
      ? isCertainSuccess(order)
      : lines.every((line) => line.alwaysSuccess === true);
  const plan = summarize(planned, materials.map(materialFromSnapshot), certainSuccess, []);
  return {
    plan,
    lines: lines.map((line, index) => ({
      lineId: line.id,
      recipeId: line.recipeId,
      quantity: line.quantity,
      saleOverride: line.saleOverride,
      fallbackName: line.name,
      kitOverride: line.kitOverride,
      kitId: line.kitId,
      kitName: line.kitName ?? order.kitName,
      plan: planned[index] ?? null,
    })),
  };
}

function resolveLineKit(
  order: Order,
  line: OrderLine,
  kits: readonly CatalogKit[],
  prices: PriceBook,
  orderKit: PlanKit,
): PlanKit {
  if (!line.kitOverride) {
    return orderKit;
  }
  const kit = line.kitId ? kits.find((item) => item.id === line.kitId) : undefined;
  if (!kit) {
    return {
      id: line.kitId ?? 0,
      name: "Cooking kit",
      produceValue: 0,
      alwaysSuccess: false,
      unitValue: null,
      inCatalog: false,
    };
  }
  return {
    id: kit.id,
    name: kit.name,
    produceValue: kit.produceValue,
    alwaysSuccess: kit.alwaysSuccess,
    unitValue: unitPriceForBasis(lookupSummary(prices, "kit", kit.id), order.priceBasis),
    inCatalog: true,
  };
}

function toPlanKit(order: Order, kit: CatalogKit | undefined, prices: PriceBook): PlanKit {
  if (!kit) {
    return {
      id: order.kitId ?? 0,
      name: order.kitName || "Cooking kit",
      produceValue: order.produceValue,
      alwaysSuccess: order.alwaysSuccess,
      unitValue: null,
      inCatalog: false,
    };
  }
  return {
    id: kit.id,
    name: kit.name,
    produceValue: kit.produceValue,
    alwaysSuccess: kit.alwaysSuccess,
    unitValue: unitPriceForBasis(lookupSummary(prices, "kit", kit.id), order.priceBasis),
    inCatalog: true,
  };
}

function toPlanRecipe(recipe: CatalogRecipe, prices: PriceBook, basis: PriceBasis): PlanRecipe {
  return {
    id: recipe.id,
    name: recipe.name,
    stat: recipe.stat,
    level: recipe.level,
    salePriceOverride: recipe.salePriceOverride,
    items: recipe.items.map((item) => ({
      id: item.ingredientId,
      name: item.name,
      quantity: item.quantity,
      unitValue: unitPriceForBasis(lookupSummary(prices, "ingredient", item.ingredientId), basis),
    })),
  };
}

function withStock(plan: OrderPlan, prices: PriceBook): OrderPlan {
  const materials = plan.materials.map((material) => {
    const summary = lookupSummary(
      prices,
      material.kind,
      material.kind === "ingredient" ? material.ingredientId : material.kitId,
    );
    const onHand = summary?.onHand ?? 0;
    return {
      ...material,
      onHand,
      shortfall: Math.max(0, material.quantity - onHand),
      priceMinimum: summary?.minimum ?? null,
      priceMaximum: summary?.maximum ?? null,
    };
  });
  const stockBlockers = materials.flatMap((material) => {
    if (material.unitValue === null || !material.shortfall) {
      return [];
    }
    return [
      `Not enough ${material.name} on hand. Need ${material.quantity}, have ${material.onHand ?? 0}.`,
    ];
  });
  return {
    ...plan,
    materials,
    blockers: [...plan.blockers, ...stockBlockers],
  };
}

function lineFromSnapshot(line: OrderLine): PlanLine {
  const suggestedSource =
    line.saleSource === "margin" || line.saleSource === "recipe" ? line.saleSource : null;
  return {
    recipeId: line.recipeId ?? 0,
    name: line.name,
    stat: line.stat,
    level: line.level,
    ingredientRowCount: line.ingredientCount,
    quantity: line.quantity,
    minRateBp: line.minRateBp ?? 0,
    avgRateBp: line.avgRateBp ?? 0,
    maxRateBp: line.maxRateBp ?? 0,
    usedRateBp: line.usedRateBp,
    attempts: line.attempts,
    oneAttemptCost: line.oneAttemptCost,
    missingNames: [],
    unitCost: line.unitCost,
    suggestedSale: suggestedSource ? line.unitSale : null,
    suggestedSource,
    unitSale: line.unitSale,
    saleSource: line.saleSource,
    saleOverride: line.saleOverride,
  };
}

function materialFromSnapshot(material: OrderMaterial): PlanMaterial {
  return {
    kind: material.kind,
    ingredientId: material.ingredientId,
    kitId: material.kitId,
    name: material.name,
    quantity: material.quantity,
    unitValue: material.unitValue,
    extendedCost: material.extendedCost,
  };
}

async function findOrder(db: KitchenDatabase, orderId: number): Promise<Order | null> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  return order ?? null;
}

async function requireDraft(db: KitchenDatabase, orderId: number): Promise<Order> {
  return requireStatus(
    db,
    orderId,
    ["draft"],
    "This order is no longer a draft, so it cannot be changed.",
  );
}

async function requireStatus(
  db: KitchenDatabase,
  orderId: number,
  allowed: readonly Order["status"][],
  message: string,
): Promise<Order> {
  const order = await findOrder(db, orderId);
  if (!order) {
    throw new OrderError("This order was not found.");
  }
  if (!allowed.includes(order.status)) {
    throw new OrderError(message);
  }
  return order;
}

async function linesForOrder(db: KitchenDatabase, orderId: number): Promise<OrderLine[]> {
  const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, orderId));
  return lines.sort((left, right) => left.position - right.position || left.id - right.id);
}

async function touchOrder(db: KitchenDatabase, orderId: number): Promise<void> {
  await db.update(orders).set({ updatedAt: timestamp() }).where(eq(orders.id, orderId));
}

function timestamp(): string {
  return new Date().toISOString();
}

type StockDb = Pick<KitchenDatabase, "select" | "insert" | "update" | "delete">;

async function deductStock(
  db: StockDb,
  orderId: number,
  materials: readonly PlanMaterial[],
): Promise<void> {
  const lots = await db.select().from(inventoryLots);
  const remaining = new Map(lots.map((lot) => [lot.id, lot.quantity]));
  const rows: {
    orderId: number;
    lotId: number;
    ingredientId: number | null;
    kitId: number | null;
    quantity: number;
    unitPrice: number;
    source: InventoryLot["source"];
    note: string;
    acquiredOn: string;
  }[] = [];

  for (const material of materials) {
    if (material.unitValue === null) {
      throw new OrderError(`Add inventory for ${material.name}.`);
    }
    const owned = lots.filter((lot) =>
      material.kind === "ingredient"
        ? lot.ingredientId === material.ingredientId
        : lot.kitId === material.kitId,
    );
    const result = allocateFifo(
      owned.map((lot) => ({
        id: lot.id,
        quantity: remaining.get(lot.id) ?? 0,
        unitPrice: lot.unitPrice,
        source: lot.source,
        note: lot.note,
        acquiredOn: lot.acquiredOn,
      })),
      material.quantity,
    );
    if (!result.ok) {
      throw new OrderError(
        `Not enough ${material.name} on hand. Need ${material.quantity}, have ${material.quantity - result.shortfall}.`,
      );
    }
    for (const slice of result.slices) {
      const lot = owned.find((item) => item.id === slice.lotId);
      if (!lot) {
        throw new OrderError("A lot disappeared during confirm.");
      }
      remaining.set(slice.lotId, (remaining.get(slice.lotId) ?? 0) - slice.quantity);
      rows.push({
        orderId,
        lotId: slice.lotId,
        ingredientId: lot.ingredientId,
        kitId: lot.kitId,
        quantity: slice.quantity,
        unitPrice: slice.unitPrice,
        source: slice.source,
        note: slice.note,
        acquiredOn: slice.acquiredOn,
      });
    }
  }

  for (const lot of lots) {
    const quantity = remaining.get(lot.id);
    if (quantity !== undefined && quantity !== lot.quantity) {
      await db.update(inventoryLots).set({ quantity }).where(eq(inventoryLots.id, lot.id));
    }
  }
  if (rows.length > 0) {
    await db.insert(orderAllocations).values(rows);
  }
}

async function restoreAllocations(db: StockDb, orderId: number): Promise<void> {
  const rows = await db
    .select()
    .from(orderAllocations)
    .where(eq(orderAllocations.orderId, orderId));
  if (rows.length === 0) {
    return;
  }
  for (const row of rows) {
    const lot =
      row.lotId === null
        ? undefined
        : (await db.select().from(inventoryLots).where(eq(inventoryLots.id, row.lotId)))[0];
    if (lot) {
      const quantity = lot.quantity + row.quantity;
      if (!Number.isSafeInteger(quantity)) {
        throw new OrderError("Restored quantity is too large.");
      }
      await db.update(inventoryLots).set({ quantity }).where(eq(inventoryLots.id, lot.id));
      continue;
    }
    if ((row.ingredientId === null) === (row.kitId === null)) {
      throw new OrderError("This order's stock allocation is missing the item it came from.");
    }
    await db.insert(inventoryLots).values({
      ingredientId: row.ingredientId,
      kitId: row.kitId,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      source: row.source,
      acquiredOn: row.acquiredOn,
      note: row.note,
    });
  }
  await db.delete(orderAllocations).where(eq(orderAllocations.orderId, orderId));
}

function asOrderError(error: unknown): Error {
  if (error instanceof OrderPlanError || error instanceof OrderError) {
    return new OrderError(error.message);
  }
  if (error instanceof Error) {
    return error;
  }
  return new OrderError("Could not update the order.");
}
