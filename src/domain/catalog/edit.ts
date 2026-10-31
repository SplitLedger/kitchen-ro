import { isFoodStat, type FoodStat } from "./food-stat";
import {
  officialIngredients,
  officialKits,
  officialRecipes,
  type OfficialIngredient,
  type OfficialKit,
  type OfficialRecipe,
} from "./official-catalog";

const maxCatalogInt = 999_999_999;
const maxNameLength = 80;

const ingredientsBySeedKey = new Map(officialIngredients.map((row) => [row.seedKey, row]));
const recipesBySeedKey = new Map(officialRecipes.map((row) => [row.seedKey, row]));
const kitsBySeedKey = new Map(officialKits.map((row) => [row.seedKey, row]));

export class CatalogEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogEditError";
  }
}

export type IngredientDraft = {
  name: string;
  referencePrice: number | null;
};

export type RecipeItemDraft = {
  ingredientId: number;
  quantity: number;
};

export type RecipeDraft = {
  name: string;
  stat: FoodStat;
  level: number;
  weight: number;
  hpRegen: number;
  spRegen: number;
  statBonus: number;
  cookbookLabel: string;
  items: RecipeItemDraft[];
};

export type KitDraft = {
  name: string;
  produceValue: number;
  alwaysSuccess: boolean;
  referencePrice: number | null;
};

export function officialIngredientBySeedKey(seedKey: string): OfficialIngredient | null {
  return ingredientsBySeedKey.get(seedKey) ?? null;
}

export function officialRecipeBySeedKey(seedKey: string): OfficialRecipe | null {
  return recipesBySeedKey.get(seedKey) ?? null;
}

export function officialKitBySeedKey(seedKey: string): OfficialKit | null {
  return kitsBySeedKey.get(seedKey) ?? null;
}

export function normalizeCatalogName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function catalogNameKey(name: string): string {
  return normalizeCatalogName(name).toLocaleLowerCase("en-US");
}

export function parseCatalogName(name: string): string {
  const normalized = normalizeCatalogName(name);
  if (!normalized) {
    throw new CatalogEditError("Name is required.");
  }
  if (normalized.length > maxNameLength) {
    throw new CatalogEditError("Name must be 80 characters or fewer.");
  }
  return normalized;
}

export function parseCookbookLabel(label: string): string {
  const normalized = normalizeCatalogName(label);
  if (!normalized) {
    throw new CatalogEditError("Cookbook note is required.");
  }
  if (normalized.length > maxNameLength) {
    throw new CatalogEditError("Cookbook note must be 80 characters or fewer.");
  }
  return normalized;
}

export function parseFoodStat(value: string): FoodStat {
  if (!isFoodStat(value)) {
    throw new CatalogEditError("Choose a stat.");
  }
  return value;
}

export function parseRequiredInt(value: string, label: string, minimum: number): number {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new CatalogEditError(`${label} is required.`);
  }
  return assertInt(Number(trimmed), trimmed, label, minimum);
}

export function parseOptionalInt(value: string, label: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return assertInt(Number(trimmed), trimmed, label, 0);
}

export function assertOptionalPrice(value: number | null, label: string): void {
  if (value === null) {
    return;
  }
  assertInt(value, String(value), label, 0);
}

export function assertRecipeItems(items: readonly RecipeItemDraft[]): void {
  if (items.length === 0) {
    throw new CatalogEditError("Add at least one ingredient.");
  }
  const seen = new Set<number>();
  for (const item of items) {
    if (!Number.isInteger(item.ingredientId) || item.ingredientId < 1) {
      throw new CatalogEditError("Choose an ingredient.");
    }
    if (seen.has(item.ingredientId)) {
      throw new CatalogEditError("Each ingredient can only appear once on a dish.");
    }
    seen.add(item.ingredientId);
    assertInt(item.quantity, String(item.quantity), "Quantity", 1);
  }
}

export function invalidMessage(check: () => unknown): string | undefined {
  try {
    check();
    return undefined;
  } catch (error) {
    if (error instanceof CatalogEditError) {
      return error.message;
    }
    throw error;
  }
}

export function sameIngredientContent(
  current: { name: string; referencePrice: number | null },
  seed: OfficialIngredient,
): boolean {
  return current.name === seed.name && current.referencePrice === seed.referencePrice;
}

export function sameKitContent(
  current: {
    name: string;
    produceValue: number;
    alwaysSuccess: boolean;
    referencePrice: number | null;
  },
  seed: OfficialKit,
): boolean {
  return (
    current.name === seed.name &&
    current.produceValue === seed.produceValue &&
    current.alwaysSuccess === seed.alwaysSuccess &&
    current.referencePrice === seed.referencePrice
  );
}

export function ingredientDiffersFromSeed(row: {
  origin: "official" | "custom";
  seedKey: string | null;
  name: string;
  referencePrice: number | null;
}): boolean {
  if (row.origin !== "official" || !row.seedKey) {
    return false;
  }
  const seed = officialIngredientBySeedKey(row.seedKey);
  return seed ? !sameIngredientContent(row, seed) : false;
}

export function kitDiffersFromSeed(row: {
  origin: "official" | "custom";
  seedKey: string | null;
  name: string;
  produceValue: number;
  alwaysSuccess: boolean;
  referencePrice: number | null;
}): boolean {
  if (row.origin !== "official" || !row.seedKey) {
    return false;
  }
  const seed = officialKitBySeedKey(row.seedKey);
  return seed ? !sameKitContent(row, seed) : false;
}

export function recipeMatchesOfficial(
  draft: RecipeDraft,
  seed: OfficialRecipe,
  ingredientSeedKeyById: ReadonlyMap<number, string | null>,
): boolean {
  if (draft.name !== seed.name || draft.stat !== seed.stat || draft.level !== seed.level) {
    return false;
  }
  if (
    draft.weight !== seed.weight ||
    draft.hpRegen !== seed.hpRegen ||
    draft.spRegen !== seed.spRegen ||
    draft.statBonus !== seed.statBonus ||
    draft.cookbookLabel !== seed.cookbookLabel
  ) {
    return false;
  }
  if (draft.items.length !== seed.items.length) {
    return false;
  }
  return draft.items.every((item, index) => {
    const officialItem = seed.items[index];
    return (
      officialItem !== undefined &&
      item.quantity === officialItem.quantity &&
      ingredientSeedKeyById.get(item.ingredientId) === officialItem.ingredientSeedKey
    );
  });
}

function assertInt(parsed: number, raw: string, label: string, minimum: number): number {
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(parsed) || parsed > maxCatalogInt) {
    throw new CatalogEditError(
      parsed > maxCatalogInt ? `${label} is too large.` : `${label} must be a whole number.`,
    );
  }
  if (parsed < minimum) {
    throw new CatalogEditError(`${label} must be at least ${minimum}.`);
  }
  return parsed;
}
