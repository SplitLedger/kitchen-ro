import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import initSqlJs, { type SqlJsDatabase, type SqlJsStatic } from "sql.js";
import { expect, test } from "vitest";
import { getCatalogRecipe } from "./catalog";
import { setRecipeSaleOverride, updateIngredient } from "./catalog-edit";
import { createKitchenDatabase, type KitchenDatabase } from "./client";
import { createSqlJsExecutor } from "./drivers/sqljs";
import { migrate } from "./migrate";
import { ingredients, recipes } from "./schema";
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

async function openSeededDatabase(): Promise<KitchenDatabase> {
  const database = await openMemoryDatabase();
  const executor = createSqlJsExecutor(database);
  await executor.execute("PRAGMA foreign_keys = ON");
  await migrate(executor);
  const db = createKitchenDatabase(executor);
  await seedOfficialCatalog(db);
  return db;
}

test("stores a recipe sale override without a typed unit price", async () => {
  const db = await openSeededDatabase();
  const oilId = await ingredientId(db, "cooking-oil");
  const legsId = await recipeId(db, "fried-grasshopper-legs");

  await updateIngredient(db, oilId, { name: "Cooking Oil", referencePrice: 500 });
  await setRecipeSaleOverride(db, legsId, 80);

  const [oil] = await db.select().from(ingredients).where(eq(ingredients.id, oilId));
  expect(oil).toMatchObject({ referencePrice: 500, name: "Cooking Oil" });
  expect(oil).not.toHaveProperty("unitValue");

  const legs = await getCatalogRecipe(db, legsId);
  expect(legs?.salePriceOverride).toBe(80);
  expect(legs?.items.find((item) => item.name === "Cooking Oil")).toMatchObject({
    referencePrice: 500,
  });

  await setRecipeSaleOverride(db, legsId, null);
  const [clearedLegs] = await db.select().from(recipes).where(eq(recipes.id, legsId));
  expect(clearedLegs?.salePriceOverride).toBeNull();
  await expect(setRecipeSaleOverride(db, legsId, 1.5)).rejects.toThrow(/whole number/i);
});

async function ingredientId(db: KitchenDatabase, seedKey: string): Promise<number> {
  const [row] = await db.select().from(ingredients).where(eq(ingredients.seedKey, seedKey));
  if (!row) {
    throw new Error(`Missing ingredient ${seedKey}.`);
  }
  return row.id;
}

async function recipeId(db: KitchenDatabase, seedKey: string): Promise<number> {
  const [row] = await db.select().from(recipes).where(eq(recipes.seedKey, seedKey));
  if (!row) {
    throw new Error(`Missing recipe ${seedKey}.`);
  }
  return row.id;
}
