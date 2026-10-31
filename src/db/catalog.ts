import { asc, eq } from "drizzle-orm";
import type { FoodStat } from "@/domain/catalog/food-stat";
import { foodStats } from "@/domain/catalog/food-stat";
import type { KitchenDatabase } from "./client";
import {
  cookingKits,
  ingredients,
  recipeItems,
  recipes,
  type CatalogOrigin,
  type CookingKit,
  type Ingredient,
} from "./schema";

export type CatalogIngredientLine = {
  ingredientId: number;
  quantity: number;
  name: string;
  referencePrice: number | null;
};

export type CatalogRecipe = {
  id: number;
  seedKey: string | null;
  name: string;
  stat: FoodStat;
  level: number;
  weight: number;
  hpRegen: number;
  spRegen: number;
  statBonus: number;
  cookbookLabel: string;
  origin: CatalogOrigin;
  diverged: boolean;
  salePriceOverride: number | null;
  archived: boolean;
  items: CatalogIngredientLine[];
};

export type CatalogKit = {
  id: number;
  seedKey: string | null;
  name: string;
  produceValue: number;
  alwaysSuccess: boolean;
  origin: CatalogOrigin;
  referencePrice: number | null;
  archived: boolean;
};

export type CatalogIngredient = {
  id: number;
  seedKey: string | null;
  name: string;
  origin: CatalogOrigin;
  referencePrice: number | null;
  archived: boolean;
};

export async function listCatalogRecipes(
  db: KitchenDatabase,
  options?: { includeArchived?: boolean },
): Promise<CatalogRecipe[]> {
  const loaded = await loadRecipes(db);
  const visible = options?.includeArchived ? loaded : loaded.filter((recipe) => !recipe.archived);
  return visible.sort((left, right) => {
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

export async function listIngredients(db: KitchenDatabase): Promise<CatalogIngredient[]> {
  const rows = await db
    .select()
    .from(ingredients)
    .orderBy(asc(ingredients.name), asc(ingredients.id));
  return rows.map(toCatalogIngredient);
}

export async function getIngredient(
  db: KitchenDatabase,
  ingredientId: number,
): Promise<CatalogIngredient | null> {
  const [row] = await db.select().from(ingredients).where(eq(ingredients.id, ingredientId));
  return row ? toCatalogIngredient(row) : null;
}

export async function listCookingKits(
  db: KitchenDatabase,
  options?: { includeArchived?: boolean },
): Promise<CatalogKit[]> {
  const rows = options?.includeArchived
    ? await db
        .select()
        .from(cookingKits)
        .orderBy(asc(cookingKits.produceValue), asc(cookingKits.name))
    : await db
        .select()
        .from(cookingKits)
        .where(eq(cookingKits.archived, false))
        .orderBy(asc(cookingKits.produceValue), asc(cookingKits.name));
  return rows.map(toCatalogKit);
}

export async function getCookingKit(
  db: KitchenDatabase,
  kitId: number,
): Promise<CatalogKit | null> {
  const [row] = await db.select().from(cookingKits).where(eq(cookingKits.id, kitId));
  return row ? toCatalogKit(row) : null;
}

function toCatalogIngredient(row: Ingredient): CatalogIngredient {
  return {
    id: row.id,
    seedKey: row.seedKey,
    name: row.name,
    origin: row.origin,
    referencePrice: row.referencePrice,
    archived: row.archived,
  };
}

function toCatalogKit(row: CookingKit): CatalogKit {
  return {
    id: row.id,
    seedKey: row.seedKey,
    name: row.name,
    produceValue: row.produceValue,
    alwaysSuccess: row.alwaysSuccess,
    origin: row.origin,
    referencePrice: row.referencePrice,
    archived: row.archived,
  };
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
      seedKey: recipe.seedKey,
      name: recipe.name,
      stat: recipe.stat,
      level: recipe.level,
      weight: recipe.weight,
      hpRegen: recipe.hpRegen,
      spRegen: recipe.spRegen,
      statBonus: recipe.statBonus,
      cookbookLabel: recipe.cookbookLabel,
      origin: recipe.origin,
      diverged: recipe.diverged,
      salePriceOverride: recipe.salePriceOverride,
      archived: recipe.archived,
      items: lines.map((line) => {
        const ingredient = ingredientsById.get(line.ingredientId);
        if (!ingredient) {
          throw new Error(`Recipe item ${line.id} points at a missing ingredient.`);
        }
        return {
          ingredientId: ingredient.id,
          quantity: line.quantity,
          name: ingredient.name,
          referencePrice: ingredient.referencePrice,
        };
      }),
    };
  });
}
