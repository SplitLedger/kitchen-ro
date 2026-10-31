import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { expect, test } from "vitest";
import journalJson from "../../drizzle/meta/_journal.json";
import { listCatalogRecipes, listCookingKits } from "./catalog";
import {
  createIngredient,
  createRecipe,
  setKitArchived,
  setRecipeArchived,
  setRecipeSaleOverride,
} from "./catalog-edit";
import { createKitchenDatabase, type KitchenDatabase } from "./client";
import { createSqlJsExecutor } from "./drivers/sqljs";
import type { SqlExecutor } from "./executor";
import { createLot, deleteLot, listInventoryLots, updateLot } from "./inventory";
import { migrate, splitSqlStatements } from "./migrate";
import {
  addOrderRecipe,
  cancelOrder,
  confirmOrder,
  createDraftOrder,
  getOrderDetail,
  listOrderSummaries,
  markOrderDone,
  reopenOrder,
  setOrderLineKit,
  setOrderLineQuantity,
  setOrderLineSale,
  updateOrderKit,
  updateOrderPlanningMode,
  updateOrderPriceBasis,
} from "./orders";
import {
  inventoryLots,
  orderAllocations,
  orderLines,
  orderMaterials,
  orders,
  recipeItems,
} from "./schema";
import { ensureSettings, readSettings } from "./settings";
import { seedOfficialCatalog } from "./seed-catalog";

let sqlModule: Promise<SqlJsStatic> | null = null;

function loadSqlModule(): Promise<SqlJsStatic> {
  sqlModule ??= readFile(
    new URL("../../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url),
  ).then((wasm) =>
    initSqlJs({
      wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength),
    }),
  );
  return sqlModule;
}

async function openSeededDatabase(): Promise<KitchenDatabase> {
  const SQL = await loadSqlModule();
  const database = new SQL.Database();
  const executor = createSqlJsExecutor(database);
  await executor.execute("PRAGMA foreign_keys = ON");
  await migrate(executor);
  const db = createKitchenDatabase(executor);
  await ensureSettings(db);
  await seedOfficialCatalog(db);
  return db;
}

test("orders stay in arrival order after a later one is edited", async () => {
  const db = await openSeededDatabase();
  const settings = await readSettings(db);
  const first = await createDraftOrder(db, settings);
  const second = await createDraftOrder(db, settings);
  await db
    .update(orders)
    .set({ updatedAt: "2099-01-01T00:00:00.000Z" })
    .where(eq(orders.id, second));

  const listed = await listOrderSummaries(db);

  expect(listed.map((order) => order.id)).toEqual([first, second]);
});

test("confirm freezes the shopping list when prices and recipes change", async () => {
  const db = await openSeededDatabase();
  const settings = await readSettings(db);
  const recipes = await listCatalogRecipes(db);
  const legs = recipes.find((recipe) => recipe.name === "Fried Grasshopper Legs");
  const soup = recipes.find((recipe) => recipe.name === "Frog Egg Squid Ink Soup");
  const outdoor = (await listCookingKits(db)).find((kit) => kit.seedKey === "outdoor");
  if (!legs || !soup || !outdoor) {
    throw new Error("Missing a seeded dish or the Outdoor Cooking Kit.");
  }

  const orderId = await createDraftOrder(db, settings);
  await addOrderRecipe(db, orderId, legs.id);
  await addOrderRecipe(db, orderId, legs.id);
  await addOrderRecipe(db, orderId, soup.id);
  const drafted = await getOrderDetail(db, orderId);
  expect(drafted?.lines.map((line) => [line.fallbackName, line.quantity])).toEqual([
    ["Fried Grasshopper Legs", 2],
    ["Frog Egg Squid Ink Soup", 1],
  ]);
  await expect(confirmOrder(db, orderId)).rejects.toThrow(/inventory/i);

  const ingredientIds = new Set([
    ...legs.items.map((item) => item.ingredientId),
    ...soup.items.map((item) => item.ingredientId),
  ]);
  for (const ingredientId of ingredientIds) {
    await stock(db, { ingredientId, unitPrice: 10 });
  }
  await stock(db, { kitId: outdoor.id, unitPrice: 100 });

  const priced = await getOrderDetail(db, orderId);
  const legsLine = priced?.lines.find((line) => line.recipeId === legs.id);
  if (!priced || !legsLine) {
    throw new Error("Missing the draft line.");
  }
  await setOrderLineSale(db, orderId, legsLine.lineId, 5000);
  const expectedAttempts = priced.lines.map((line) => line.plan?.attempts);
  await updateOrderPlanningMode(db, orderId, "conservative");
  const conservative = await getOrderDetail(db, orderId);
  const conservativeAttempts = conservative?.lines.map((line) => line.plan?.attempts);
  expect(conservativeAttempts).not.toEqual(expectedAttempts);
  expect(conservative?.plan.blockers).toEqual([]);

  await confirmOrder(db, orderId);
  const confirmed = await getOrderDetail(db, orderId);
  if (!confirmed) {
    throw new Error("Missing the confirmed order.");
  }
  expect(confirmed.order.status).toBe("confirmed");
  expect(confirmed.order.confirmedAt).toBeTruthy();
  expect(confirmed.lines.find((line) => line.recipeId === legs.id)?.plan).toMatchObject({
    quantity: 2,
    unitSale: 5000,
    saleSource: "line",
  });
  const frozenMaterials = confirmed.plan.materials.map((material) => ({
    name: material.name,
    quantity: material.quantity,
    unitValue: material.unitValue,
    extendedCost: material.extendedCost,
  }));
  const frozenLines = confirmed.lines.map((line) => ({
    name: line.plan?.name,
    attempts: line.plan?.attempts,
    unitCost: line.plan?.unitCost,
    unitSale: line.plan?.unitSale,
  }));

  const shared = legs.items[0];
  if (!shared) {
    throw new Error("Missing an ingredient line.");
  }
  const pricedLot = (await listInventoryLots(db)).find(
    (lot) => lot.ingredientId === shared.ingredientId,
  );
  if (!pricedLot) {
    throw new Error("Missing the stocked lot.");
  }
  await updateLot(db, pricedLot.id, {
    quantity: pricedLot.quantity,
    unitPrice: 80,
    source: pricedLot.source,
    acquiredOn: pricedLot.acquiredOn,
    note: pricedLot.note,
  });
  await createLot(db, {
    ingredientId: shared.ingredientId,
    kitId: null,
    quantity: 1,
    unitPrice: 9_000,
    source: "farmed",
    acquiredOn: "2026-10-31",
    note: "after confirm",
  });
  const [storedItem] = await db.select().from(recipeItems).where(eq(recipeItems.recipeId, legs.id));
  if (!storedItem) {
    throw new Error("Missing a stored recipe item.");
  }
  await db.update(recipeItems).set({ quantity: 50 }).where(eq(recipeItems.id, storedItem.id));
  await setRecipeSaleOverride(db, soup.id, 1);

  const reread = await getOrderDetail(db, orderId);
  expect(reread?.order.status).toBe("confirmed");
  expect(
    reread?.plan.materials.map((material) => ({
      name: material.name,
      quantity: material.quantity,
      unitValue: material.unitValue,
      extendedCost: material.extendedCost,
    })),
  ).toEqual(frozenMaterials);
  expect(
    reread?.lines.map((line) => ({
      name: line.plan?.name,
      attempts: line.plan?.attempts,
      unitCost: line.plan?.unitCost,
      unitSale: line.plan?.unitSale,
    })),
  ).toEqual(frozenLines);
  expect(await db.select().from(orderMaterials)).toHaveLength(frozenMaterials.length);

  const freshId = await createDraftOrder(db, settings);
  await addOrderRecipe(db, freshId, legs.id);
  const fresh = await getOrderDetail(db, freshId);
  expect(fresh?.lines[0]?.plan?.unitCost).not.toBe(frozenLines[0]?.unitCost);
  await expect(confirmOrder(db, orderId)).rejects.toThrow(/no longer a draft/i);
});

test("done and cancelled orders keep the snapshot until reopen recalculates", async () => {
  const db = await openSeededDatabase();
  const settings = await readSettings(db);
  const recipes = await listCatalogRecipes(db);
  const legs = recipes.find((recipe) => recipe.name === "Fried Grasshopper Legs");
  const outdoor = (await listCookingKits(db)).find((kit) => kit.seedKey === "outdoor");
  if (!legs || !outdoor) {
    throw new Error("Missing a seeded dish or the Outdoor Cooking Kit.");
  }
  for (const item of legs.items) {
    await stock(db, { ingredientId: item.ingredientId, unitPrice: 10 });
  }
  await stock(db, { kitId: outdoor.id, unitPrice: 100 });

  const orderId = await createDraftOrder(db, settings);
  await addOrderRecipe(db, orderId, legs.id);
  const drafted = await getOrderDetail(db, orderId);
  const line = drafted?.lines[0];
  if (!line?.plan?.unitCost) {
    throw new Error("Missing a priced draft line.");
  }
  await setOrderLineSale(db, orderId, line.lineId, 5000);
  await confirmOrder(db, orderId);
  const frozenCost = line.plan.unitCost;
  const frozenMaterials = (await getOrderDetail(db, orderId))?.plan.materials.length;
  await markOrderDone(db, orderId);
  await expect(cancelOrder(db, orderId)).rejects.toThrow(/confirmed/i);

  const shared = legs.items[0];
  if (!shared) {
    throw new Error("Missing an ingredient line.");
  }
  const sharedLot = (await listInventoryLots(db)).find(
    (lot) => lot.ingredientId === shared.ingredientId,
  );
  if (!sharedLot) {
    throw new Error("Missing the stocked lot.");
  }
  await updateLot(db, sharedLot.id, {
    quantity: sharedLot.quantity,
    unitPrice: 80,
    source: sharedLot.source,
    acquiredOn: sharedLot.acquiredOn,
    note: sharedLot.note,
  });
  const done = await getOrderDetail(db, orderId);
  expect(done?.order.status).toBe("done");
  expect(done?.lines[0]?.plan?.unitCost).toBe(frozenCost);
  expect(done?.lines[0]?.plan?.unitSale).toBe(5000);
  expect(done?.plan.materials).toHaveLength(frozenMaterials ?? 0);

  await reopenOrder(db, orderId);
  const reopened = await getOrderDetail(db, orderId);
  expect(reopened?.order.status).toBe("draft");
  expect(reopened?.order.confirmedAt).toBeNull();
  expect(reopened?.lines[0]?.plan?.unitCost).not.toBe(frozenCost);
  expect(reopened?.lines[0]?.plan?.unitSale).toBe(5000);
  expect(await db.select().from(orderMaterials)).toEqual([]);
  const [stored] = await db.select().from(orderLines).where(eq(orderLines.orderId, orderId));
  expect(stored?.unitCost).toBeNull();
  expect(stored?.attempts).toBeNull();
  expect(stored?.saleOverride).toBe(5000);
  await expect(markOrderDone(db, orderId)).rejects.toThrow(/confirmed/i);

  await confirmOrder(db, orderId);
  await cancelOrder(db, orderId);
  const cancelled = await getOrderDetail(db, orderId);
  expect(cancelled?.order.status).toBe("cancelled");
  expect(cancelled?.plan.materials.length).toBeGreaterThan(0);
  await expect(markOrderDone(db, orderId)).rejects.toThrow(/confirmed/i);
  await reopenOrder(db, orderId);
  expect((await getOrderDetail(db, orderId))?.order.status).toBe("draft");
});

test("the order picker leaves archived dishes and kits out", async () => {
  const db = await openSeededDatabase();
  const settings = await readSettings(db);
  const recipes = await listCatalogRecipes(db, { includeArchived: true });
  const legs = recipes.find((recipe) => recipe.name === "Fried Grasshopper Legs");
  const kits = await listCookingKits(db, { includeArchived: true });
  const home = kits.find((kit) => kit.seedKey === "home");
  const outdoor = kits.find((kit) => kit.seedKey === "outdoor");
  if (!legs || !home || !outdoor) {
    throw new Error("Missing a seeded dish or kit.");
  }
  await setRecipeArchived(db, legs.id, true);
  await setKitArchived(db, home.id, true);
  const orderId = await createDraftOrder(db, settings);
  await setKitArchived(db, outdoor.id, true);
  const detail = await getOrderDetail(db, orderId);
  expect(detail?.pickerRecipes.some((recipe) => recipe.id === legs.id)).toBe(false);
  expect(detail?.pickerKits.some((kit) => kit.id === home.id)).toBe(false);
  expect(detail?.pickerKits.find((kit) => kit.id === outdoor.id)?.archived).toBe(true);
  await expect(addOrderRecipe(db, orderId, legs.id)).rejects.toThrow(/unarchive/i);
});

test("confirm deducts lots FIFO and cancel or reopen restores them once", async () => {
  const db = await openSeededDatabase();
  const settings = await readSettings(db);
  const fantastic = (await listCookingKits(db, { includeArchived: true })).find(
    (kit) => kit.seedKey === "fantastic",
  );
  if (!fantastic) {
    throw new Error("Missing the Fantastic Cooking Kit.");
  }
  const herbId = await createIngredient(db, { name: "Test Herb", referencePrice: 12 });
  const recipeId = await createRecipe(db, {
    name: "Test Salad",
    stat: "str",
    level: 1,
    weight: 1,
    hpRegen: 0,
    spRegen: 0,
    statBonus: 0,
    cookbookLabel: "Notes",
    items: [{ ingredientId: herbId, quantity: 2 }],
  });
  const older = await createLot(db, {
    ingredientId: herbId,
    kitId: null,
    quantity: 3,
    unitPrice: 10,
    source: "bought",
    acquiredOn: "2026-01-01",
    note: "first",
  });
  await stock(db, { kitId: fantastic.id, unitPrice: 5, quantity: 100 });

  const orderId = await createDraftOrder(db, settings);
  expect((await getOrderDetail(db, orderId))?.order.priceBasis).toBe("average");
  await updateOrderKit(db, orderId, fantastic.id);
  await updateOrderPriceBasis(db, orderId, "minimum");
  await addOrderRecipe(db, orderId, recipeId);
  await addOrderRecipe(db, orderId, recipeId);
  const blocked = await getOrderDetail(db, orderId);
  expect(
    blocked?.plan.materials.find((material) => material.ingredientId === herbId),
  ).toMatchObject({
    quantity: 4,
    onHand: 3,
    shortfall: 1,
  });
  await expect(confirmOrder(db, orderId)).rejects.toThrow(/not enough/i);

  const newer = await createLot(db, {
    ingredientId: herbId,
    kitId: null,
    quantity: 10,
    unitPrice: 50,
    source: "farmed",
    acquiredOn: "2026-06-01",
    note: "second",
  });
  const short = await getOrderDetail(db, orderId);
  expect(short?.plan.materials.find((material) => material.ingredientId === herbId)).toMatchObject({
    quantity: 4,
    onHand: 13,
    shortfall: 0,
    unitValue: 10,
    priceMinimum: 10,
    priceMaximum: 50,
  });
  await expect(confirmOrder(db, orderId)).resolves.toBeUndefined();

  const afterConfirm = await listInventoryLots(db);
  expect(afterConfirm.find((lot) => lot.id === older)).toMatchObject({
    quantity: 0,
    unitPrice: 10,
  });
  expect(afterConfirm.find((lot) => lot.id === newer)).toMatchObject({
    quantity: 9,
    unitPrice: 50,
  });
  const kitLotId = afterConfirm.find((lot) => lot.kitId === fantastic.id)?.id;
  const slices = await db
    .select()
    .from(orderAllocations)
    .where(eq(orderAllocations.orderId, orderId));
  expect(
    slices
      .map((slice) => [slice.lotId, slice.quantity, slice.unitPrice])
      .sort((left, right) => Number(left[0]) - Number(right[0])),
  ).toEqual(
    [
      [older, 3, 10],
      [newer, 1, 50],
      [kitLotId, 2, 5],
    ].sort((left, right) => Number(left[0]) - Number(right[0])),
  );
  const confirmed = await getOrderDetail(db, orderId);
  expect(
    confirmed?.plan.materials.find((material) => material.ingredientId === herbId)?.unitValue,
  ).toBe(10);

  await createLot(db, {
    ingredientId: herbId,
    kitId: null,
    quantity: 20,
    unitPrice: 1,
    source: "bought",
    acquiredOn: "2026-10-31",
    note: "later",
  });
  expect(
    (await getOrderDetail(db, orderId))?.plan.materials.find(
      (material) => material.ingredientId === herbId,
    )?.unitValue,
  ).toBe(10);

  const held = quantities(await listInventoryLots(db));
  await markOrderDone(db, orderId);
  expect(quantities(await listInventoryLots(db))).toEqual(held);

  await deleteLot(db, older);
  await reopenOrder(db, orderId);
  const restored = await listInventoryLots(db);
  expect(restored.find((lot) => lot.id === older)).toBeUndefined();
  expect(restored.find((lot) => lot.note === "first")).toMatchObject({
    ingredientId: herbId,
    quantity: 3,
    unitPrice: 10,
    source: "bought",
    acquiredOn: "2026-01-01",
  });
  expect(restored.find((lot) => lot.id === newer)?.quantity).toBe(10);
  expect(await db.select().from(orderAllocations)).toEqual([]);

  await confirmOrder(db, orderId);
  await cancelOrder(db, orderId);
  const cancelled = quantities(await listInventoryLots(db));
  await reopenOrder(db, orderId);
  expect(quantities(await listInventoryLots(db))).toEqual(cancelled);
  expect((await getOrderDetail(db, orderId))?.order.status).toBe("draft");
});

test("an inheriting dish follows the default kit and an override keeps its own", async () => {
  const db = await openSeededDatabase();
  const settings = await readSettings(db);
  const kits = await listCookingKits(db);
  const outdoor = kits.find((kit) => kit.seedKey === "outdoor");
  const home = kits.find((kit) => kit.seedKey === "home");
  const fantastic = kits.find((kit) => kit.seedKey === "fantastic");
  if (!outdoor || !home || !fantastic) {
    throw new Error("Missing a seeded cooking kit.");
  }
  const herbId = await createIngredient(db, { name: "Line Herb", referencePrice: 4 });
  const firstId = await createRecipe(db, {
    name: "First Bowl",
    stat: "str",
    level: 1,
    weight: 1,
    hpRegen: 0,
    spRegen: 0,
    statBonus: 0,
    cookbookLabel: "Notes",
    items: [{ ingredientId: herbId, quantity: 1 }],
  });
  const secondId = await createRecipe(db, {
    name: "Second Bowl",
    stat: "agi",
    level: 1,
    weight: 1,
    hpRegen: 0,
    spRegen: 0,
    statBonus: 0,
    cookbookLabel: "Notes",
    items: [{ ingredientId: herbId, quantity: 1 }],
  });
  await stock(db, { ingredientId: herbId, unitPrice: 4 });
  const outdoorLot = await createLot(db, {
    ingredientId: null,
    kitId: outdoor.id,
    quantity: 10,
    unitPrice: 100,
    source: "bought",
    acquiredOn: "2026-01-01",
    note: "outdoor",
  });
  const homeLot = await createLot(db, {
    ingredientId: null,
    kitId: home.id,
    quantity: 10,
    unitPrice: 80,
    source: "bought",
    acquiredOn: "2026-01-01",
    note: "home",
  });
  const fantasticLot = await createLot(db, {
    ingredientId: null,
    kitId: fantastic.id,
    quantity: 10,
    unitPrice: 50,
    source: "bought",
    acquiredOn: "2026-01-01",
    note: "fantastic",
  });

  const orderId = await createDraftOrder(db, settings);
  await addOrderRecipe(db, orderId, firstId);
  await addOrderRecipe(db, orderId, secondId);
  const drafted = await getOrderDetail(db, orderId);
  const first = drafted?.lines[0];
  const second = drafted?.lines[1];
  if (!drafted || !first || !second) {
    throw new Error("Missing the draft lines.");
  }
  expect(drafted.order.kitId).toBe(outdoor.id);
  expect(first.kitOverride).toBe(false);
  expect(second.kitOverride).toBe(false);
  expect(first.kitName).toBe("Outdoor Cooking Kit");
  expect(second.kitName).toBe("Outdoor Cooking Kit");
  await setOrderLineQuantity(db, orderId, first.lineId, 3);
  await setOrderLineQuantity(db, orderId, second.lineId, 3);
  const sized = await getOrderDetail(db, orderId);
  const outdoorAttempts = sized?.lines[0]?.plan?.attempts;
  if (!outdoorAttempts) {
    throw new Error("Missing the outdoor attempt count.");
  }

  await setOrderLineKit(db, orderId, second.lineId, fantastic.id);
  await addOrderRecipe(db, orderId, secondId);
  const kept = await getOrderDetail(db, orderId);
  expect(kept?.lines[1]).toMatchObject({
    quantity: 4,
    kitOverride: true,
    kitId: fantastic.id,
    kitName: "Fantastic Cooking Kit",
  });
  expect(kept?.lines[1]?.plan?.attempts).toBe(4);
  await setOrderLineQuantity(db, orderId, second.lineId, 3);

  await updateOrderKit(db, orderId, home.id);
  const moved = await getOrderDetail(db, orderId);
  const homeAttempts = moved?.lines[0]?.plan?.attempts;
  const overrideAttempts = moved?.lines[1]?.plan?.attempts;
  if (!moved || homeAttempts === undefined || homeAttempts === null || !overrideAttempts) {
    throw new Error("Missing the planned attempts.");
  }
  expect(moved.lines[0]).toMatchObject({
    kitOverride: false,
    kitId: null,
    kitName: "Home Cooking Kit",
  });
  expect(homeAttempts).not.toBe(outdoorAttempts);
  expect(moved.lines[1]).toMatchObject({
    kitOverride: true,
    kitId: fantastic.id,
    kitName: "Fantastic Cooking Kit",
  });
  expect(overrideAttempts).toBe(3);
  expect(moved.plan.certainSuccess).toBe(false);
  expect(
    moved.plan.materials
      .filter((material) => material.kind === "kit")
      .map((material) => [material.name, material.quantity]),
  ).toEqual([
    ["Fantastic Cooking Kit", overrideAttempts],
    ["Home Cooking Kit", homeAttempts],
  ]);

  await confirmOrder(db, orderId);
  const lots = await listInventoryLots(db);
  expect(lots.find((lot) => lot.id === homeLot)?.quantity).toBe(10 - homeAttempts);
  expect(lots.find((lot) => lot.id === fantasticLot)?.quantity).toBe(10 - overrideAttempts);
  expect(lots.find((lot) => lot.id === outdoorLot)?.quantity).toBe(10);
  const stored = await db.select().from(orderLines).where(eq(orderLines.orderId, orderId));
  const storedFirst = stored.find((line) => line.recipeId === firstId);
  const storedSecond = stored.find((line) => line.recipeId === secondId);
  expect(storedFirst).toMatchObject({
    kitId: null,
    kitOverride: false,
    kitName: "Home Cooking Kit",
    alwaysSuccess: false,
  });
  expect(storedSecond).toMatchObject({
    kitId: fantastic.id,
    kitOverride: true,
    kitName: "Fantastic Cooking Kit",
    alwaysSuccess: true,
  });

  await reopenOrder(db, orderId);
  const reopened = await db.select().from(orderLines).where(eq(orderLines.orderId, orderId));
  expect(reopened.every((line) => line.kitName === null && line.alwaysSuccess === null)).toBe(true);
  expect(reopened.find((line) => line.recipeId === secondId)?.kitOverride).toBe(true);

  await setOrderLineKit(db, orderId, second.lineId, null);
  const cleared = await getOrderDetail(db, orderId);
  expect(cleared?.lines[1]).toMatchObject({
    kitOverride: false,
    kitId: null,
    kitName: "Home Cooking Kit",
  });
  expect(cleared?.lines[0]?.plan?.attempts).toBe(cleared?.lines[1]?.plan?.attempts);
  const [afterClear] = await db.select().from(orderLines).where(eq(orderLines.id, second.lineId));
  expect(afterClear).toMatchObject({ kitId: null, kitOverride: false });
});

test("migration 0006 keeps existing orders and backfills a confirmed line kit", async () => {
  const SQL = await loadSqlModule();
  const database = new SQL.Database();
  const executor = createSqlJsExecutor(database);
  await executor.execute("PRAGMA foreign_keys = ON");
  await applyRecorded(executor, "0005_inventory_lots");
  await executor.execute(
    "INSERT INTO cooking_kits (name, produce_value, always_success, origin, archived) VALUES ('Camp Kit', 12, 1, 'custom', 0)",
  );
  await executor.execute(
    "INSERT INTO orders (customer_name, notes, status, planning_mode, price_basis, kit_id, kit_name, produce_value, always_success, base_level, dex, luk, mastery, margin_percent, created_at, updated_at) VALUES ('Draft Customer', 'keep this note', 'draft', 'expected', 'average', 1, 'Camp Kit', 12, 1, 99, 99, 1, 0, 20, '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z')",
  );
  await executor.execute(
    "INSERT INTO orders (customer_name, notes, status, planning_mode, price_basis, kit_id, kit_name, produce_value, always_success, base_level, dex, luk, mastery, margin_percent, created_at, updated_at, confirmed_at) VALUES ('Confirmed Customer', 'frozen note', 'confirmed', 'conservative', 'minimum', 1, 'Camp Kit', 12, 1, 80, 50, 2, 3, 15, '2026-02-01T00:00:00.000Z', '2026-02-02T00:00:00.000Z', '2026-02-03T00:00:00.000Z')",
  );
  await executor.execute(
    "INSERT INTO order_lines (order_id, position, name, stat, level, ingredient_count, quantity, sale_override) VALUES (1, 0, 'Draft Stew', 'str', 3, 2, 4, 25)",
  );
  await executor.execute(
    "INSERT INTO order_lines (order_id, position, name, stat, level, ingredient_count, quantity, min_rate_bp, avg_rate_bp, max_rate_bp, used_rate_bp, attempts, one_attempt_cost, unit_cost, unit_sale, sale_source, sale_override) VALUES (2, 0, 'Confirmed Stew', 'agi', 5, 3, 2, 1900, 3200, 4500, 1900, 6, 40, 211, 500, 'line', 500)",
  );
  await executor.execute(
    "INSERT INTO order_materials (order_id, position, kind, kit_id, name, quantity, unit_value, extended_cost) VALUES (2, 0, 'kit', 1, 'Camp Kit', 6, 15, 90)",
  );
  await executor.execute(
    "INSERT INTO inventory_lots (kit_id, quantity, unit_price, source, acquired_on, note) VALUES (1, 7, 15, 'bought', '2026-03-01', 'keep this lot')",
  );

  await migrate(executor);

  const db = createKitchenDatabase(executor);
  const [draftOrder] = await db.select().from(orders).where(eq(orders.id, 1));
  const [confirmedOrder] = await db.select().from(orders).where(eq(orders.id, 2));
  expect(draftOrder).toMatchObject({
    customerName: "Draft Customer",
    notes: "keep this note",
    status: "draft",
    kitName: "Camp Kit",
  });
  expect(confirmedOrder).toMatchObject({
    customerName: "Confirmed Customer",
    notes: "frozen note",
    status: "confirmed",
    kitName: "Camp Kit",
    confirmedAt: "2026-02-03T00:00:00.000Z",
  });
  const lines = await db.select().from(orderLines);
  expect(lines).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        orderId: 1,
        name: "Draft Stew",
        quantity: 4,
        saleOverride: 25,
        kitId: null,
        kitOverride: false,
        kitName: null,
        alwaysSuccess: null,
      }),
      expect.objectContaining({
        orderId: 2,
        name: "Confirmed Stew",
        quantity: 2,
        minRateBp: 1900,
        avgRateBp: 3200,
        maxRateBp: 4500,
        usedRateBp: 1900,
        attempts: 6,
        oneAttemptCost: 40,
        unitCost: 211,
        unitSale: 500,
        saleSource: "line",
        saleOverride: 500,
        kitId: null,
        kitOverride: false,
        kitName: "Camp Kit",
        alwaysSuccess: true,
      }),
    ]),
  );
  expect(lines).toHaveLength(2);
  const [material] = await db.select().from(orderMaterials);
  expect(material).toMatchObject({
    orderId: 2,
    kind: "kit",
    kitId: 1,
    name: "Camp Kit",
    quantity: 6,
    unitValue: 15,
    extendedCost: 90,
  });
  const [lot] = await db.select().from(inventoryLots);
  expect(lot).toMatchObject({
    kitId: 1,
    quantity: 7,
    unitPrice: 15,
    note: "keep this lot",
  });

  await executor.execute(
    "INSERT INTO order_lines (order_id, position, name, stat, level, ingredient_count, quantity) VALUES (1, 1, 'Next', 'str', 1, 1, 1)",
  );
  const [next] = await executor.select<{ id: number }>(
    "SELECT id FROM order_lines WHERE name = 'Next'",
  );
  expect(next?.id).toBe(3);
});

function quantities(lots: { id: number; quantity: number }[]): Record<number, number> {
  return Object.fromEntries(lots.map((lot) => [lot.id, lot.quantity]));
}

const journal = journalJson as { entries: Array<{ tag: string; when: number }> };

async function applyRecorded(executor: SqlExecutor, untilTag: string): Promise<void> {
  await executor.execute(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id integer PRIMARY KEY AUTOINCREMENT,
      hash text NOT NULL UNIQUE,
      created_at integer
    )
  `);
  for (const entry of journal.entries) {
    const sqlText = await readFile(
      new URL(`../../drizzle/${entry.tag}.sql`, import.meta.url),
      "utf8",
    );
    await executor.execute("BEGIN");
    try {
      for (const statement of splitSqlStatements(sqlText)) {
        await executor.execute(statement);
      }
      await executor.execute(
        'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)',
        [entry.tag, entry.when],
      );
      await executor.execute("COMMIT");
    } catch (error) {
      await executor.execute("ROLLBACK");
      throw error;
    }
    if (entry.tag === untilTag) {
      return;
    }
  }
  throw new Error(`Missing migration ${untilTag}.`);
}

async function stock(
  db: KitchenDatabase,
  item: { ingredientId?: number; kitId?: number; unitPrice: number; quantity?: number },
): Promise<void> {
  await createLot(db, {
    ingredientId: item.ingredientId ?? null,
    kitId: item.kitId ?? null,
    quantity: item.quantity ?? 100_000,
    unitPrice: item.unitPrice,
    source: "bought",
    acquiredOn: "2026-01-01",
    note: "",
  });
}
