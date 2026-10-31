import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import initSqlJs, { type SqlJsDatabase, type SqlJsStatic } from "sql.js";
import { expect, test } from "vitest";
import { getCatalogRecipe, listCatalogRecipes, listCookingKits } from "./catalog";
import { createKitchenDatabase } from "./client";
import { createSqlJsExecutor } from "./drivers/sqljs";
import { migrate } from "./migrate";
import { cookingKits, ingredients, recipeItems, recipes } from "./schema";
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

async function openMemoryDatabase(): Promise<SqlJsDatabase> {
  const SQL = await loadSqlModule();
  return new SQL.Database();
}

async function openSeededDatabase() {
  const database = await openMemoryDatabase();
  const executor = createSqlJsExecutor(database);
  await executor.execute("PRAGMA foreign_keys = ON");
  await migrate(executor);
  const db = createKitchenDatabase(executor);
  await seedOfficialCatalog(db);
  return db;
}

test("seeds official rows once and leaves later edits in place", async () => {
  const db = await openSeededDatabase();
  const firstRecipes = await listCatalogRecipes(db);
  expect(firstRecipes).toHaveLength(60);
  expect(
    firstRecipes.slice(0, 6).map((recipe) => [recipe.level, recipe.stat, recipe.name]),
  ).toEqual([
    [1, "str", "Fried Grasshopper Legs"],
    [1, "agi", "Frog Egg Squid Ink Soup"],
    [1, "vit", "Steamed Crab Nippers"],
    [1, "int", "Grape Juice Herbal Tea"],
    [1, "dex", "Honey Grape Juice"],
    [1, "luk", "Fried Monkey Tails"],
  ]);
  expect(firstRecipes[6]).toMatchObject({ level: 2 });
  expect(firstRecipes.map((recipe) => recipe.stat).filter((stat) => stat === "luk")).toHaveLength(
    10,
  );

  const legs = firstRecipes.find((recipe) => recipe.name === "Fried Grasshopper Legs");
  expect(
    legs?.items.map(({ quantity, name, referencePrice }) => ({ quantity, name, referencePrice })),
  ).toEqual([
    { quantity: 5, name: "Grasshopper's Leg", referencePrice: null },
    { quantity: 1, name: "Old Frying Pan", referencePrice: null },
    { quantity: 1, name: "Cooking Oil", referencePrice: 500 },
  ]);

  const tongue = firstRecipes.find((recipe) => recipe.name === "Steamed Tongue");
  expect(tongue?.items).toHaveLength(8);
  expect(tongue?.cookbookLabel).toBe("Level 10 Cookbook");

  const kits = await listCookingKits(db);
  expect(
    kits.map((kit) => [kit.name, kit.produceValue, kit.alwaysSuccess, kit.referencePrice]),
  ).toEqual([
    ["Outdoor Cooking Kit", 11, false, 500],
    ["Home Cooking Kit", 12, false, 1000],
    ["Professional Cooking Kit", 13, false, null],
    ["Royal Cooking Kit", 14, false, null],
    ["Fantastic Cooking Kit", 15, true, null],
  ]);

  const oil = await db.select().from(ingredients).where(eq(ingredients.seedKey, "cooking-oil"));
  await db
    .update(ingredients)
    .set({ name: "House Oil", referencePrice: 12 })
    .where(eq(ingredients.id, oil[0]!.id));
  await db
    .update(recipes)
    .set({ name: "Crispy Legs", diverged: true, archived: true })
    .where(eq(recipes.seedKey, "fried-grasshopper-legs"));
  const legsItems = await db.select().from(recipeItems).where(eq(recipeItems.recipeId, legs!.id));
  const firstLine = legsItems.find((item) => item.position === 0);
  if (!firstLine) {
    throw new Error("Missing the first ingredient line.");
  }
  await db.update(recipeItems).set({ quantity: 9 }).where(eq(recipeItems.id, firstLine.id));

  const itemCount = (await db.select().from(recipeItems)).length;
  await seedOfficialCatalog(db);
  expect(await db.select().from(recipeItems)).toHaveLength(itemCount);

  const editedOil = await db
    .select()
    .from(ingredients)
    .where(eq(ingredients.seedKey, "cooking-oil"));
  expect(editedOil[0]).toMatchObject({ name: "House Oil", referencePrice: 12 });

  const editedLegs = await db
    .select()
    .from(recipes)
    .where(eq(recipes.seedKey, "fried-grasshopper-legs"));
  expect(editedLegs[0]).toMatchObject({ name: "Crispy Legs", diverged: true, archived: true });
  const editedDetail = await getCatalogRecipe(db, legs!.id);
  expect(editedDetail?.items[0]?.quantity).toBe(9);
  expect((await listCatalogRecipes(db)).some((recipe) => recipe.id === legs!.id)).toBe(false);

  await db.delete(recipes).where(eq(recipes.seedKey, "steamed-tongue"));
  expect(await getCatalogRecipe(db, tongue!.id)).toBeNull();
  await seedOfficialCatalog(db);
  const restored = (await listCatalogRecipes(db)).find(
    (recipe) => recipe.name === "Steamed Tongue",
  );
  expect(restored?.items).toHaveLength(8);
  expect(restored?.items.map((item) => item.name)).toContain("Aloe Vera");

  const kitCount = (await db.select().from(cookingKits)).length;
  await db.delete(cookingKits).where(eq(cookingKits.seedKey, "fantastic"));
  await seedOfficialCatalog(db);
  expect(await db.select().from(cookingKits)).toHaveLength(kitCount);
  const fantastic = await db.select().from(cookingKits).where(eq(cookingKits.seedKey, "fantastic"));
  expect(fantastic[0]).toMatchObject({ alwaysSuccess: true, produceValue: 15 });
});
