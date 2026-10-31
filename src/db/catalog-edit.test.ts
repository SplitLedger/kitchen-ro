import { readFile } from "node:fs/promises";
import { eq, sql } from "drizzle-orm";
import initSqlJs, { type SqlJsDatabase, type SqlJsStatic } from "sql.js";
import { expect, test } from "vitest";
import { getCatalogRecipe, listCatalogRecipes, listCookingKits } from "./catalog";
import {
  createIngredient,
  createKit,
  createRecipe,
  deleteIngredient,
  deleteKit,
  deleteRecipe,
  resetIngredient,
  resetKit,
  resetRecipe,
  setRecipeArchived,
  updateIngredient,
  updateKit,
  updateRecipe,
} from "./catalog-edit";
import { createKitchenDatabase, type KitchenDatabase } from "./client";
import { createSqlJsExecutor } from "./drivers/sqljs";
import { migrate } from "./migrate";
import {
  cookingKits,
  ingredients,
  orderLines,
  orderMaterials,
  orders,
  recipeItems,
  recipes,
} from "./schema";
import { seedOfficialCatalog } from "./seed-catalog";
import type { RecipeDraft } from "@/domain/catalog/edit";

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
  const database: SqlJsDatabase = new SQL.Database();
  const executor = createSqlJsExecutor(database);
  await executor.execute("PRAGMA foreign_keys = ON");
  await migrate(executor);
  const db = createKitchenDatabase(executor);
  await seedOfficialCatalog(db);
  return db;
}

async function ingredientId(db: KitchenDatabase, name: string): Promise<number> {
  const [row] = await db.select().from(ingredients).where(eq(ingredients.name, name));
  if (!row) {
    throw new Error(`Missing ingredient ${name}.`);
  }
  return row.id;
}

function legsDraft(grasshopperId: number, panId: number, oilId: number, quantity = 5): RecipeDraft {
  return {
    name: "Fried Grasshopper Legs",
    stat: "str",
    level: 1,
    weight: 6,
    hpRegen: 5,
    spRegen: 0,
    statBonus: 1,
    cookbookLabel: "Level 1 Cookbook",
    items: [
      { ingredientId: grasshopperId, quantity },
      { ingredientId: panId, quantity: 1 },
      { ingredientId: oilId, quantity: 1 },
    ],
  };
}

test("rejects a duplicate ingredient name and keeps custom seed keys empty", async () => {
  const db = await openSeededDatabase();
  await expect(createIngredient(db, { name: "  meat ", referencePrice: 10 })).rejects.toThrow(
    /already used/i,
  );
  await expect(createIngredient(db, { name: "MEAT", referencePrice: null })).rejects.toThrow(
    /already used/i,
  );

  const createdId = await createIngredient(db, { name: "Cooking-Oil", referencePrice: 12 });
  const [created] = await db.select().from(ingredients).where(eq(ingredients.id, createdId));
  expect(created).toMatchObject({
    seedKey: null,
    origin: "custom",
    name: "Cooking-Oil",
    referencePrice: 12,
  });
  const [official] = await db
    .select()
    .from(ingredients)
    .where(eq(ingredients.seedKey, "cooking-oil"));
  expect(official?.name).toBe("Cooking Oil");
  expect(official?.id).not.toBe(createdId);
});

test("resets an official ingredient without touching the archive flag", async () => {
  const db = await openSeededDatabase();
  const oilId = await ingredientId(db, "Cooking Oil");
  await updateIngredient(db, oilId, { name: "House Oil", referencePrice: 12 });
  await db.update(ingredients).set({ archived: true }).where(eq(ingredients.id, oilId));

  await resetIngredient(db, oilId);
  const [oil] = await db.select().from(ingredients).where(eq(ingredients.id, oilId));
  expect(oil).toMatchObject({
    seedKey: "cooking-oil",
    name: "Cooking Oil",
    referencePrice: 500,
    archived: true,
    origin: "official",
  });
});

test("refuses to reset an official name onto a custom row that already uses it", async () => {
  const db = await openSeededDatabase();
  const oilId = await ingredientId(db, "Cooking Oil");
  await updateIngredient(db, oilId, { name: "House Oil", referencePrice: 500 });
  await createIngredient(db, { name: "Cooking Oil", referencePrice: 1 });
  await expect(resetIngredient(db, oilId)).rejects.toThrow(/already used/i);
  const [oil] = await db.select().from(ingredients).where(eq(ingredients.id, oilId));
  expect(oil?.name).toBe("House Oil");
});

test("deletes a custom ingredient only when nothing still uses it", async () => {
  const db = await openSeededDatabase();
  const oilId = await ingredientId(db, "Cooking Oil");
  await expect(deleteIngredient(db, oilId)).rejects.toThrow(/Archive this one/i);

  const pepperId = await createIngredient(db, { name: "Dragon Pepper", referencePrice: 42 });
  const recipeId = await createRecipe(db, {
    name: "Pepper Test",
    stat: "luk",
    level: 1,
    weight: 1,
    hpRegen: 0,
    spRegen: 0,
    statBonus: 0,
    cookbookLabel: "Level 1 Cookbook",
    items: [{ ingredientId: pepperId, quantity: 2 }],
  });
  await expect(deleteIngredient(db, pepperId)).rejects.toThrow(/still used by a dish/i);
  await deleteRecipe(db, recipeId);
  await deleteIngredient(db, pepperId);
  expect(await db.select().from(ingredients).where(eq(ingredients.id, pepperId))).toHaveLength(0);
});

test("edits an official dish, archives it, and resets the seed", async () => {
  const db = await openSeededDatabase();
  const legs = (await listCatalogRecipes(db)).find(
    (recipe) => recipe.name === "Fried Grasshopper Legs",
  );
  if (!legs) {
    throw new Error("Missing Fried Grasshopper Legs.");
  }
  const grasshopperId = legs.items[0]?.ingredientId;
  const panId = legs.items[1]?.ingredientId;
  const oilId = legs.items[2]?.ingredientId;
  if (!grasshopperId || !panId || !oilId) {
    throw new Error("Missing Fried Grasshopper Legs ingredients.");
  }

  await db.update(recipes).set({ salePriceOverride: 123 }).where(eq(recipes.id, legs.id));
  await updateRecipe(db, legs.id, legsDraft(grasshopperId, panId, oilId, 9));
  const edited = await getCatalogRecipe(db, legs.id);
  expect(edited).toMatchObject({ diverged: true, archived: false });
  expect(edited?.items[0]).toMatchObject({ quantity: 9, name: "Grasshopper's Leg" });
  await updateRecipe(db, legs.id, legsDraft(grasshopperId, panId, oilId, 5));
  expect((await getCatalogRecipe(db, legs.id))?.diverged).toBe(false);
  await updateRecipe(db, legs.id, legsDraft(grasshopperId, panId, oilId, 9));
  expect((await listCatalogRecipes(db)).some((recipe) => recipe.id === legs.id)).toBe(true);

  const meatId = await ingredientId(db, "Meat");
  await updateRecipe(db, legs.id, {
    ...legsDraft(meatId, panId, oilId, 4),
    name: "Crispy Legs",
  });
  await resetRecipe(db, legs.id);
  const restored = await getCatalogRecipe(db, legs.id);
  expect(restored).toMatchObject({
    name: "Fried Grasshopper Legs",
    diverged: false,
    cookbookLabel: "Level 1 Cookbook",
  });
  expect(restored?.items.map((item) => [item.name, item.quantity])).toEqual([
    ["Grasshopper's Leg", 5],
    ["Old Frying Pan", 1],
    ["Cooking Oil", 1],
  ]);
  const [stored] = await db.select().from(recipes).where(eq(recipes.id, legs.id));
  expect(stored?.salePriceOverride).toBe(123);

  await setRecipeArchived(db, legs.id, true);
  expect((await listCatalogRecipes(db)).some((recipe) => recipe.id === legs.id)).toBe(false);
  expect(
    (await listCatalogRecipes(db, { includeArchived: true })).some(
      (recipe) => recipe.id === legs.id,
    ),
  ).toBe(true);
  const archived = await getCatalogRecipe(db, legs.id);
  expect(archived?.archived).toBe(true);
});

test("saves a custom dish and deletes it when no confirmed order uses it", async () => {
  const db = await openSeededDatabase();
  const pepperId = await createIngredient(db, { name: "Dragon Pepper", referencePrice: null });
  const recipeId = await createRecipe(db, {
    name: "  Test Stew  ",
    stat: "vit",
    level: 4,
    weight: 10,
    hpRegen: 2,
    spRegen: 1,
    statBonus: 3,
    cookbookLabel: "Notes",
    items: [{ ingredientId: pepperId, quantity: 2 }],
  });
  const [stored] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
  expect(stored).toMatchObject({
    seedKey: null,
    origin: "custom",
    name: "Test Stew",
    diverged: false,
    cookbookLabel: "Notes",
  });
  const listed = (await listCatalogRecipes(db)).find((recipe) => recipe.id === recipeId);
  expect(listed?.items).toEqual([
    {
      ingredientId: pepperId,
      quantity: 2,
      name: "Dragon Pepper",
      referencePrice: null,
    },
  ]);

  const legs = (await listCatalogRecipes(db)).find(
    (recipe) => recipe.name === "Fried Grasshopper Legs",
  );
  if (!legs) {
    throw new Error("Missing Fried Grasshopper Legs.");
  }
  await expect(deleteRecipe(db, legs.id)).rejects.toThrow(/Archive this one/i);

  await expect(
    createRecipe(db, {
      name: "Empty",
      stat: "str",
      level: 1,
      weight: 0,
      hpRegen: 0,
      spRegen: 0,
      statBonus: 0,
      cookbookLabel: "Level 1 Cookbook",
      items: [],
    }),
  ).rejects.toThrow(/at least one ingredient/i);
  await expect(
    createRecipe(db, {
      name: "Twice",
      stat: "str",
      level: 1,
      weight: 0,
      hpRegen: 0,
      spRegen: 0,
      statBonus: 0,
      cookbookLabel: "Level 1 Cookbook",
      items: [
        { ingredientId: pepperId, quantity: 1 },
        { ingredientId: pepperId, quantity: 2 },
      ],
    }),
  ).rejects.toThrow(/only appear once/i);

  await deleteRecipe(db, recipeId);
  expect(await getCatalogRecipe(db, recipeId)).toBeNull();
  expect(
    await db.select().from(recipeItems).where(eq(recipeItems.recipeId, recipeId)),
  ).toHaveLength(0);
});

test("a confirmed order keeps a custom dish, ingredient, and kit", async () => {
  const db = await openSeededDatabase();
  const pepperId = await createIngredient(db, { name: "Dragon Pepper", referencePrice: 1 });
  const recipeId = await createRecipe(db, {
    name: "Pepper Test",
    stat: "str",
    level: 1,
    weight: 1,
    hpRegen: 0,
    spRegen: 0,
    statBonus: 0,
    cookbookLabel: "Level 1 Cookbook",
    items: [{ ingredientId: pepperId, quantity: 1 }],
  });
  const kitId = await createKit(db, {
    name: "Camp Kit",
    produceValue: 20,
    alwaysSuccess: false,
    referencePrice: 15,
  });

  await db.insert(orders).values({
    id: 1,
    status: "confirmed",
    kitId,
    kitName: "Camp Kit",
    produceValue: 20,
    alwaysSuccess: false,
    baseLevel: 99,
    dex: 99,
    luk: 1,
    mastery: 0,
    marginPercent: 20,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  await db.insert(orderLines).values({
    orderId: 1,
    recipeId,
    position: 0,
    name: "Pepper Test",
    stat: "str",
    level: 1,
    ingredientCount: 1,
    quantity: 1,
  });
  await db.insert(orderMaterials).values([
    {
      orderId: 1,
      position: 0,
      kind: "ingredient",
      ingredientId: pepperId,
      name: "Dragon Pepper",
      quantity: 1,
    },
    {
      orderId: 1,
      position: 1,
      kind: "kit",
      kitId,
      name: "Camp Kit",
      quantity: 1,
    },
  ]);

  await expect(deleteRecipe(db, recipeId)).rejects.toThrow(/confirmed order/i);

  await db.run(sql`delete from order_lines`);
  await db.run(sql`delete from recipe_items where recipe_id = ${recipeId}`);
  await expect(deleteIngredient(db, pepperId)).rejects.toThrow(/confirmed order/i);
  await expect(deleteKit(db, kitId)).rejects.toThrow(/confirmed order/i);

  await db.run(sql`update orders set status = 'draft' where id = 1`);
  await deleteIngredient(db, pepperId);
  await deleteKit(db, kitId);
  await deleteRecipe(db, recipeId);
});

test("edits a kit and resets the official fields", async () => {
  const db = await openSeededDatabase();
  const [outdoor] = await listCookingKits(db);
  if (!outdoor || outdoor.seedKey !== "outdoor") {
    throw new Error("Missing the Outdoor Cooking Kit.");
  }
  await db.update(cookingKits).set({ archived: true }).where(eq(cookingKits.id, outdoor.id));
  await updateKit(db, outdoor.id, {
    name: "Camp Kit",
    produceValue: 20,
    alwaysSuccess: true,
    referencePrice: 12,
  });
  await resetKit(db, outdoor.id);
  const [restored] = await db.select().from(cookingKits).where(eq(cookingKits.id, outdoor.id));
  expect(restored).toMatchObject({
    seedKey: "outdoor",
    name: "Outdoor Cooking Kit",
    produceValue: 11,
    alwaysSuccess: false,
    referencePrice: 500,
    archived: true,
    origin: "official",
  });

  await expect(deleteKit(db, outdoor.id)).rejects.toThrow(/Archive this one/i);
  const customId = await createKit(db, {
    name: "Outdoor-Cooking-Kit",
    produceValue: 11,
    alwaysSuccess: false,
    referencePrice: null,
  });
  const [custom] = await db.select().from(cookingKits).where(eq(cookingKits.id, customId));
  expect(custom).toMatchObject({ seedKey: null, origin: "custom" });
  await expect(
    createKit(db, {
      name: "outdoor cooking kit",
      produceValue: 1,
      alwaysSuccess: false,
      referencePrice: null,
    }),
  ).rejects.toThrow(/already used/i);
});
