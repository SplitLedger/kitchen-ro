import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { expect, test } from "vitest";
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
import { createLot, deleteLot, listInventoryLots, updateLot } from "./inventory";
import { migrate } from "./migrate";
import {
  addOrderRecipe,
  cancelOrder,
  confirmOrder,
  createDraftOrder,
  getOrderDetail,
  listOrderSummaries,
  markOrderDone,
  reopenOrder,
  setOrderLineSale,
  updateOrderKit,
  updateOrderPlanningMode,
  updateOrderPriceBasis,
} from "./orders";
import { orderAllocations, orderLines, orderMaterials, orders, recipeItems } from "./schema";
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

function quantities(lots: { id: number; quantity: number }[]): Record<number, number> {
  return Object.fromEntries(lots.map((lot) => [lot.id, lot.quantity]));
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
