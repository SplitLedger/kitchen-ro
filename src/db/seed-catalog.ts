import { inArray, isNotNull } from "drizzle-orm";
import type { KitchenDatabase } from "./client";
import {
  officialIngredients,
  officialKits,
  officialRecipes,
  type OfficialIngredient,
  type OfficialKit,
  type OfficialRecipe,
} from "@/domain/catalog/official-catalog";
import { cookingKits, ingredients, recipeItems, recipes } from "./schema";

// Insert official rows whose seed key is missing. Edited rows stay as they are.

type CatalogWriter = Pick<KitchenDatabase, "insert" | "select">;

export async function seedOfficialCatalog(db: KitchenDatabase): Promise<void> {
  const existingIngredientKeys = await seedKeys(db, ingredients);
  const existingKitKeys = await seedKeys(db, cookingKits);
  const existingRecipeKeys = await seedKeys(db, recipes);

  const missingIngredients = officialIngredients.filter(
    (row) => !existingIngredientKeys.has(row.seedKey),
  );
  const missingKits = officialKits.filter((row) => !existingKitKeys.has(row.seedKey));
  const missingRecipes = officialRecipes.filter((row) => !existingRecipeKeys.has(row.seedKey));

  if (missingIngredients.length === 0 && missingKits.length === 0 && missingRecipes.length === 0) {
    return;
  }

  await db.transaction(async (tx) => {
    await insertIngredients(tx, missingIngredients);
    await insertKits(tx, missingKits);
    await insertRecipes(tx, missingRecipes);
  });
}

async function seedKeys(
  db: KitchenDatabase,
  table: typeof ingredients | typeof cookingKits | typeof recipes,
): Promise<Set<string>> {
  const rows = await db
    .select({ seedKey: table.seedKey })
    .from(table)
    .where(isNotNull(table.seedKey));
  return new Set(rows.flatMap((row) => (row.seedKey ? [row.seedKey] : [])));
}

async function insertIngredients(
  db: CatalogWriter,
  rows: readonly OfficialIngredient[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }
  await db.insert(ingredients).values(
    rows.map((row) => ({
      seedKey: row.seedKey,
      name: row.name,
      origin: "official" as const,
      referencePrice: row.referencePrice,
    })),
  );
}

async function insertKits(db: CatalogWriter, rows: readonly OfficialKit[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }
  await db.insert(cookingKits).values(
    rows.map((row) => ({
      seedKey: row.seedKey,
      name: row.name,
      produceValue: row.produceValue,
      alwaysSuccess: row.alwaysSuccess,
      origin: "official" as const,
      referencePrice: row.referencePrice,
    })),
  );
}

async function insertRecipes(db: CatalogWriter, rows: readonly OfficialRecipe[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  await db.insert(recipes).values(
    rows.map((row) => ({
      seedKey: row.seedKey,
      name: row.name,
      stat: row.stat,
      level: row.level,
      weight: row.weight,
      hpRegen: row.hpRegen,
      spRegen: row.spRegen,
      statBonus: row.statBonus,
      cookbookLabel: row.cookbookLabel,
      origin: "official" as const,
    })),
  );

  const storedIngredients = await db
    .select({ id: ingredients.id, seedKey: ingredients.seedKey })
    .from(ingredients)
    .where(isNotNull(ingredients.seedKey));
  const ingredientIdByKey = new Map(
    storedIngredients.flatMap((row) => (row.seedKey ? [[row.seedKey, row.id] as const] : [])),
  );

  const storedRecipes = await db
    .select({ id: recipes.id, seedKey: recipes.seedKey })
    .from(recipes)
    .where(
      inArray(
        recipes.seedKey,
        rows.map((row) => row.seedKey),
      ),
    );
  const recipeIdByKey = new Map(
    storedRecipes.flatMap((row) => (row.seedKey ? [[row.seedKey, row.id] as const] : [])),
  );

  const items = rows.flatMap((recipe) => {
    const recipeId = recipeIdByKey.get(recipe.seedKey);
    if (recipeId === undefined) {
      throw new Error(`Official recipe ${recipe.name} was not inserted.`);
    }
    return recipe.items.map((item, position) => {
      const ingredientId = ingredientIdByKey.get(item.ingredientSeedKey);
      if (ingredientId === undefined) {
        throw new Error(`Official ingredient ${item.ingredientName} is missing.`);
      }
      return {
        recipeId,
        ingredientId,
        quantity: item.quantity,
        position,
      };
    });
  });

  await db.insert(recipeItems).values(items);
}
