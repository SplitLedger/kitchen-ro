import { asc, eq } from "drizzle-orm";
import type { KitchenDatabase } from "./client";
import { foodStats, type FoodStat } from "@/domain/catalog/food-stat";
import { cookingKits, ingredients, recipeItems, recipes } from "./schema";

export type CatalogIngredientLine = {
  quantity: number;
  name: string;
  referencePrice: number | null;
};

export type CatalogRecipe = {
  id: number;
  name: string;
  stat: FoodStat;
  level: number;
  weight: number;
  hpRegen: number;
  spRegen: number;
  statBonus: number;
  cookbookLabel: string;
  archived: boolean;
  items: CatalogIngredientLine[];
};

export type CatalogKit = {
  id: number;
  name: string;
  produceValue: number;
  alwaysSuccess: boolean;
  referencePrice: number | null;
};

export async function listCatalogRecipes(db: KitchenDatabase): Promise<CatalogRecipe[]> {
  const loaded = await loadRecipes(db);
  return loaded
    .filter((recipe) => !recipe.archived)
    .sort((left, right) => {
      if (left.level !== right.level) {
        return left.level - right.level;
      }
      return foodStats.indexOf(left.stat) - foodStats.indexOf(right.stat);
    });
}

export async function getCatalogRecipe(
  db: KitchenDatabase,
  recipeId: number,
): Promise<CatalogRecipe | null> {
  const loaded = await loadRecipes(db);
  return loaded.find((recipe) => recipe.id === recipeId) ?? null;
}

export async function listCookingKits(db: KitchenDatabase): Promise<CatalogKit[]> {
  const rows = await db
    .select()
    .from(cookingKits)
    .where(eq(cookingKits.archived, false))
    .orderBy(asc(cookingKits.produceValue), asc(cookingKits.name));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    produceValue: row.produceValue,
    alwaysSuccess: row.alwaysSuccess,
    referencePrice: row.referencePrice,
  }));
}

async function loadRecipes(db: KitchenDatabase): Promise<CatalogRecipe[]> {
  const recipeRows = await db.select().from(recipes);
  const itemRows = await db.select().from(recipeItems);
  const ingredientRows = await db.select().from(ingredients);
  const ingredientsById = new Map(ingredientRows.map((row) => [row.id, row]));
  const itemsByRecipe = new Map<number, typeof itemRows>();

  for (const item of itemRows) {
    const lines = itemsByRecipe.get(item.recipeId) ?? [];
    lines.push(item);
    itemsByRecipe.set(item.recipeId, lines);
  }

  return recipeRows.map((recipe) => {
    const lines = [...(itemsByRecipe.get(recipe.id) ?? [])].sort(
      (left, right) => left.position - right.position,
    );
    return {
      id: recipe.id,
      name: recipe.name,
      stat: recipe.stat,
      level: recipe.level,
      weight: recipe.weight,
      hpRegen: recipe.hpRegen,
      spRegen: recipe.spRegen,
      statBonus: recipe.statBonus,
      cookbookLabel: recipe.cookbookLabel,
      archived: recipe.archived,
      items: lines.map((line) => {
        const ingredient = ingredientsById.get(line.ingredientId);
        if (!ingredient) {
          throw new Error(`Recipe item ${line.id} points at a missing ingredient.`);
        }
        return {
          quantity: line.quantity,
          name: ingredient.name,
          referencePrice: ingredient.referencePrice,
        };
      }),
    };
  });
}
