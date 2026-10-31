import { eq, inArray, sql } from "drizzle-orm";
import {
  CatalogEditError,
  assertOptionalPrice,
  assertRecipeItems,
  catalogNameKey,
  officialIngredientBySeedKey,
  officialKitBySeedKey,
  officialRecipeBySeedKey,
  parseCatalogName,
  parseCookbookLabel,
  recipeMatchesOfficial,
  type IngredientDraft,
  type KitDraft,
  type RecipeDraft,
  type RecipeItemDraft,
} from "@/domain/catalog/edit";
import { isFoodStat } from "@/domain/catalog/food-stat";
import type { KitchenDatabase } from "./client";
import {
  cookingKits,
  ingredients,
  inventoryLots,
  orderAllocations,
  recipeItems,
  recipes,
  type CatalogOrigin,
} from "./schema";

type CatalogKind = "ingredient" | "recipe" | "kit";
type OrderTable = "orders" | "order_lines" | "order_materials";

// Confirmed orders block deletion once those tables exist.
// order_lines.recipe_id, order_materials.ingredient_id, and order_materials.kit_id
// point at catalog rows. orders.status = 'confirmed' is the only blocking status.

export async function catalogNameClash(
  db: KitchenDatabase,
  kind: CatalogKind,
  name: string,
  exceptId?: number,
): Promise<string | null> {
  const key = catalogNameKey(name);
  if (!key) {
    return null;
  }
  const rows = await listNames(db, kind);
  const clash = rows.find((row) => row.id !== exceptId && catalogNameKey(row.name) === key);
  return clash?.name ?? null;
}

export async function createIngredient(
  db: KitchenDatabase,
  draft: IngredientDraft,
): Promise<number> {
  const name = parseCatalogName(draft.name);
  assertOptionalPrice(draft.referencePrice, "Reference price");
  await assertUniqueName(db, "ingredient", name);
  const [created] = await db
    .insert(ingredients)
    .values({
      seedKey: null,
      name,
      origin: "custom",
      referencePrice: draft.referencePrice,
      archived: false,
    })
    .returning({ id: ingredients.id });
  if (!created) {
    throw new Error("Could not save the ingredient.");
  }
  return created.id;
}

export async function updateIngredient(
  db: KitchenDatabase,
  ingredientId: number,
  draft: IngredientDraft,
): Promise<void> {
  await requireIngredient(db, ingredientId);
  const name = parseCatalogName(draft.name);
  assertOptionalPrice(draft.referencePrice, "Reference price");
  await assertUniqueName(db, "ingredient", name, ingredientId);
  await db
    .update(ingredients)
    .set({ name, referencePrice: draft.referencePrice })
    .where(eq(ingredients.id, ingredientId));
}

export async function setIngredientArchived(
  db: KitchenDatabase,
  ingredientId: number,
  archived: boolean,
): Promise<void> {
  await requireIngredient(db, ingredientId);
  await db.update(ingredients).set({ archived }).where(eq(ingredients.id, ingredientId));
}

export async function resetIngredient(db: KitchenDatabase, ingredientId: number): Promise<void> {
  const row = await requireIngredient(db, ingredientId);
  const seed = officialSeed(row.origin, row.seedKey, officialIngredientBySeedKey, "ingredient");
  await assertUniqueName(db, "ingredient", seed.name, ingredientId);
  await db
    .update(ingredients)
    .set({ name: seed.name, referencePrice: seed.referencePrice })
    .where(eq(ingredients.id, ingredientId));
}

export async function deleteIngredient(db: KitchenDatabase, ingredientId: number): Promise<void> {
  const row = await requireIngredient(db, ingredientId);
  assertDeletable(row.origin, "ingredient");
  const [used] = await db
    .select({ id: recipeItems.id })
    .from(recipeItems)
    .where(eq(recipeItems.ingredientId, ingredientId))
    .limit(1);
  if (used) {
    throw new CatalogEditError(
      "This ingredient is still used by a dish. Remove it from those recipes before deleting it.",
    );
  }
  if (await referencedByConfirmedOrder(db, "ingredient", ingredientId)) {
    throw new CatalogEditError("This ingredient is on a confirmed order, so it cannot be deleted.");
  }
  await assertInventoryClear(db, "ingredient", ingredientId);
  await db.delete(ingredients).where(eq(ingredients.id, ingredientId));
}

export async function createRecipe(db: KitchenDatabase, draft: RecipeDraft): Promise<number> {
  const prepared = prepareRecipeDraft(draft);
  await assertUniqueName(db, "recipe", prepared.name);
  await assertIngredientsExist(db, prepared.items);
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(recipes)
      .values({
        seedKey: null,
        name: prepared.name,
        stat: prepared.stat,
        level: prepared.level,
        weight: prepared.weight,
        hpRegen: prepared.hpRegen,
        spRegen: prepared.spRegen,
        statBonus: prepared.statBonus,
        cookbookLabel: prepared.cookbookLabel,
        origin: "custom",
        diverged: false,
        archived: false,
      })
      .returning({ id: recipes.id });
    if (!created) {
      throw new Error("Could not save the dish.");
    }
    await replaceRecipeItems(tx, created.id, prepared.items);
    return created.id;
  });
}

export async function updateRecipe(
  db: KitchenDatabase,
  recipeId: number,
  draft: RecipeDraft,
): Promise<void> {
  const current = await requireRecipe(db, recipeId);
  const prepared = prepareRecipeDraft(draft);
  await assertUniqueName(db, "recipe", prepared.name, recipeId);
  const ingredientSeedKeyById = await assertIngredientsExist(db, prepared.items);
  const seed = current.seedKey ? officialRecipeBySeedKey(current.seedKey) : null;
  const diverged =
    current.origin === "official" && seed
      ? !recipeMatchesOfficial(prepared, seed, ingredientSeedKeyById)
      : false;
  await db.transaction(async (tx) => {
    await tx
      .update(recipes)
      .set({
        name: prepared.name,
        stat: prepared.stat,
        level: prepared.level,
        weight: prepared.weight,
        hpRegen: prepared.hpRegen,
        spRegen: prepared.spRegen,
        statBonus: prepared.statBonus,
        cookbookLabel: prepared.cookbookLabel,
        diverged,
      })
      .where(eq(recipes.id, recipeId));
    await replaceRecipeItems(tx, recipeId, prepared.items);
  });
}

export async function setRecipeArchived(
  db: KitchenDatabase,
  recipeId: number,
  archived: boolean,
): Promise<void> {
  await requireRecipe(db, recipeId);
  await db.update(recipes).set({ archived }).where(eq(recipes.id, recipeId));
}

export async function resetRecipe(db: KitchenDatabase, recipeId: number): Promise<void> {
  const current = await requireRecipe(db, recipeId);
  const seed = officialSeed(current.origin, current.seedKey, officialRecipeBySeedKey, "dish");
  await assertUniqueName(db, "recipe", seed.name, recipeId);
  const storedIngredients = await db
    .select({ id: ingredients.id, seedKey: ingredients.seedKey })
    .from(ingredients);
  const ingredientIdByKey = new Map(
    storedIngredients.flatMap((row) => (row.seedKey ? [[row.seedKey, row.id] as const] : [])),
  );
  const items = seed.items.map((item) => {
    const ingredientId = ingredientIdByKey.get(item.ingredientSeedKey);
    if (ingredientId === undefined) {
      throw new CatalogEditError(
        `The official ingredient ${item.ingredientName} is missing. Reload the app to restore the seed.`,
      );
    }
    return { ingredientId, quantity: item.quantity };
  });
  await db.transaction(async (tx) => {
    await tx
      .update(recipes)
      .set({
        name: seed.name,
        stat: seed.stat,
        level: seed.level,
        weight: seed.weight,
        hpRegen: seed.hpRegen,
        spRegen: seed.spRegen,
        statBonus: seed.statBonus,
        cookbookLabel: seed.cookbookLabel,
        diverged: false,
      })
      .where(eq(recipes.id, recipeId));
    await replaceRecipeItems(tx, recipeId, items);
  });
}

export async function deleteRecipe(db: KitchenDatabase, recipeId: number): Promise<void> {
  const row = await requireRecipe(db, recipeId);
  assertDeletable(row.origin, "dish");
  if (await referencedByConfirmedOrder(db, "recipe", recipeId)) {
    throw new CatalogEditError("This dish is on a confirmed order, so it cannot be deleted.");
  }
  await db.delete(recipes).where(eq(recipes.id, recipeId));
}

export async function createKit(db: KitchenDatabase, draft: KitDraft): Promise<number> {
  const prepared = prepareKitDraft(draft);
  await assertUniqueName(db, "kit", prepared.name);
  const [created] = await db
    .insert(cookingKits)
    .values({
      seedKey: null,
      name: prepared.name,
      produceValue: prepared.produceValue,
      alwaysSuccess: prepared.alwaysSuccess,
      origin: "custom",
      referencePrice: prepared.referencePrice,
      archived: false,
    })
    .returning({ id: cookingKits.id });
  if (!created) {
    throw new Error("Could not save the kit.");
  }
  return created.id;
}

export async function updateKit(
  db: KitchenDatabase,
  kitId: number,
  draft: KitDraft,
): Promise<void> {
  await requireKit(db, kitId);
  const prepared = prepareKitDraft(draft);
  await assertUniqueName(db, "kit", prepared.name, kitId);
  await db
    .update(cookingKits)
    .set({
      name: prepared.name,
      produceValue: prepared.produceValue,
      alwaysSuccess: prepared.alwaysSuccess,
      referencePrice: prepared.referencePrice,
    })
    .where(eq(cookingKits.id, kitId));
}

export async function setKitArchived(
  db: KitchenDatabase,
  kitId: number,
  archived: boolean,
): Promise<void> {
  await requireKit(db, kitId);
  await db.update(cookingKits).set({ archived }).where(eq(cookingKits.id, kitId));
}

export async function resetKit(db: KitchenDatabase, kitId: number): Promise<void> {
  const row = await requireKit(db, kitId);
  const seed = officialSeed(row.origin, row.seedKey, officialKitBySeedKey, "kit");
  await assertUniqueName(db, "kit", seed.name, kitId);
  await db
    .update(cookingKits)
    .set({
      name: seed.name,
      produceValue: seed.produceValue,
      alwaysSuccess: seed.alwaysSuccess,
      referencePrice: seed.referencePrice,
    })
    .where(eq(cookingKits.id, kitId));
}

export async function setRecipeSaleOverride(
  db: KitchenDatabase,
  recipeId: number,
  salePriceOverride: number | null,
): Promise<void> {
  await requireRecipe(db, recipeId);
  assertOptionalPrice(salePriceOverride, "Sale price");
  await db.update(recipes).set({ salePriceOverride }).where(eq(recipes.id, recipeId));
}

export async function deleteKit(db: KitchenDatabase, kitId: number): Promise<void> {
  const row = await requireKit(db, kitId);
  assertDeletable(row.origin, "kit");
  if (await referencedByConfirmedOrder(db, "kit", kitId)) {
    throw new CatalogEditError("This kit is on a confirmed order, so it cannot be deleted.");
  }
  await assertInventoryClear(db, "kit", kitId);
  await db.delete(cookingKits).where(eq(cookingKits.id, kitId));
}

function prepareRecipeDraft(draft: RecipeDraft): RecipeDraft {
  if (!isFoodStat(draft.stat)) {
    throw new CatalogEditError("Choose a stat.");
  }
  const prepared = {
    name: parseCatalogName(draft.name),
    stat: draft.stat,
    level: draft.level,
    weight: draft.weight,
    hpRegen: draft.hpRegen,
    spRegen: draft.spRegen,
    statBonus: draft.statBonus,
    cookbookLabel: parseCookbookLabel(draft.cookbookLabel),
    items: draft.items,
  };
  assertIntField(prepared.level, "Level", 1);
  assertIntField(prepared.weight, "Weight", 0);
  assertIntField(prepared.hpRegen, "HP regen", 0);
  assertIntField(prepared.spRegen, "SP regen", 0);
  assertIntField(prepared.statBonus, "Stat bonus", 0);
  assertRecipeItems(prepared.items);
  return prepared;
}

function prepareKitDraft(draft: KitDraft): KitDraft {
  if (typeof draft.alwaysSuccess !== "boolean") {
    throw new CatalogEditError("Choose whether this kit always succeeds.");
  }
  const prepared = {
    name: parseCatalogName(draft.name),
    produceValue: draft.produceValue,
    alwaysSuccess: draft.alwaysSuccess,
    referencePrice: draft.referencePrice,
  };
  assertIntField(prepared.produceValue, "Produce value", 0);
  assertOptionalPrice(prepared.referencePrice, "Reference price");
  return prepared;
}

function assertIntField(value: number, label: string, minimum: number): void {
  if (!Number.isInteger(value)) {
    throw new CatalogEditError(`${label} must be a whole number.`);
  }
  if (value > 999_999_999) {
    throw new CatalogEditError(`${label} is too large.`);
  }
  if (value < minimum) {
    throw new CatalogEditError(`${label} must be at least ${minimum}.`);
  }
}

async function assertUniqueName(
  db: KitchenDatabase,
  kind: CatalogKind,
  name: string,
  exceptId?: number,
): Promise<void> {
  const clash = await catalogNameClash(db, kind, name, exceptId);
  if (clash) {
    throw new CatalogEditError(`"${clash}" is already used.`);
  }
}

async function listNames(
  db: KitchenDatabase,
  kind: CatalogKind,
): Promise<Array<{ id: number; name: string }>> {
  if (kind === "ingredient") {
    return db.select({ id: ingredients.id, name: ingredients.name }).from(ingredients);
  }
  if (kind === "recipe") {
    return db.select({ id: recipes.id, name: recipes.name }).from(recipes);
  }
  return db.select({ id: cookingKits.id, name: cookingKits.name }).from(cookingKits);
}

async function assertIngredientsExist(
  db: KitchenDatabase,
  items: readonly RecipeItemDraft[],
): Promise<Map<number, string | null>> {
  const ids = items.map((item) => item.ingredientId);
  const rows = await db
    .select({ id: ingredients.id, seedKey: ingredients.seedKey })
    .from(ingredients)
    .where(inArray(ingredients.id, ids));
  if (rows.length !== new Set(ids).size) {
    throw new CatalogEditError("Choose an ingredient that is still in the catalog.");
  }
  return new Map(rows.map((row) => [row.id, row.seedKey]));
}

async function replaceRecipeItems(
  db: Pick<KitchenDatabase, "insert" | "delete">,
  recipeId: number,
  items: readonly RecipeItemDraft[],
): Promise<void> {
  await db.delete(recipeItems).where(eq(recipeItems.recipeId, recipeId));
  if (items.length === 0) {
    return;
  }
  await db.insert(recipeItems).values(
    items.map((item, position) => ({
      recipeId,
      ingredientId: item.ingredientId,
      quantity: item.quantity,
      position,
    })),
  );
}

async function requireIngredient(db: KitchenDatabase, ingredientId: number) {
  const [row] = await db.select().from(ingredients).where(eq(ingredients.id, ingredientId));
  if (!row) {
    throw new CatalogEditError("That ingredient is not in the catalog.");
  }
  return row;
}

async function requireRecipe(db: KitchenDatabase, recipeId: number) {
  const [row] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
  if (!row) {
    throw new CatalogEditError("That dish is not in the catalog.");
  }
  return row;
}

async function requireKit(db: KitchenDatabase, kitId: number) {
  const [row] = await db.select().from(cookingKits).where(eq(cookingKits.id, kitId));
  if (!row) {
    throw new CatalogEditError("That kit is not in the catalog.");
  }
  return row;
}

function officialSeed<T>(
  origin: CatalogOrigin,
  seedKey: string | null,
  lookup: (seedKey: string) => T | null,
  noun: "ingredient" | "dish" | "kit",
): T {
  if (origin !== "official" || !seedKey) {
    throw new CatalogEditError(`Only an official ${noun} can be reset from the seed.`);
  }
  const seed = lookup(seedKey);
  if (!seed) {
    throw new CatalogEditError(`This official ${noun} has no seed to restore.`);
  }
  return seed;
}

function assertDeletable(origin: CatalogOrigin, noun: "ingredient" | "dish" | "kit"): void {
  if (origin === "custom") {
    return;
  }
  const plural = noun === "dish" ? "dishes" : `${noun}s`;
  throw new CatalogEditError(
    `Official ${plural} stay in the catalog. Archive this one to hide it.`,
  );
}

async function assertInventoryClear(
  db: KitchenDatabase,
  kind: "ingredient" | "kit",
  id: number,
): Promise<void> {
  const noun = kind === "ingredient" ? "ingredient" : "kit";
  const lots =
    kind === "ingredient"
      ? await db
          .select({ id: inventoryLots.id })
          .from(inventoryLots)
          .where(eq(inventoryLots.ingredientId, id))
          .limit(1)
      : await db
          .select({ id: inventoryLots.id })
          .from(inventoryLots)
          .where(eq(inventoryLots.kitId, id))
          .limit(1);
  if (lots.length > 0) {
    throw new CatalogEditError(`Delete this ${noun}'s inventory lots before deleting it.`);
  }
  const allocations =
    kind === "ingredient"
      ? await db
          .select({ id: orderAllocations.id })
          .from(orderAllocations)
          .where(eq(orderAllocations.ingredientId, id))
          .limit(1)
      : await db
          .select({ id: orderAllocations.id })
          .from(orderAllocations)
          .where(eq(orderAllocations.kitId, id))
          .limit(1);
  if (allocations.length > 0) {
    throw new CatalogEditError(
      `This ${noun} is still allocated to an order, so it cannot be deleted.`,
    );
  }
}

async function referencedByConfirmedOrder(
  db: KitchenDatabase,
  kind: "recipe" | "ingredient" | "kit",
  id: number,
): Promise<boolean> {
  const orders = await columnNames(db, "orders");
  if (!orders.has("id") || !orders.has("status")) {
    return false;
  }
  if (kind === "recipe") {
    const lines = await columnNames(db, "order_lines");
    if (!lines.has("recipe_id") || !lines.has("order_id")) {
      return false;
    }
    const rows = await db.all(sql`
      select 1 as hit
      from order_lines
      inner join orders on orders.id = order_lines.order_id
      where order_lines.recipe_id = ${id} and orders.status = 'confirmed'
      limit 1
    `);
    return hasRows(rows);
  }
  const materials = await columnNames(db, "order_materials");
  const column = kind === "ingredient" ? "ingredient_id" : "kit_id";
  if (!materials.has(column) || !materials.has("order_id")) {
    return false;
  }
  const rows =
    kind === "ingredient"
      ? await db.all(sql`
          select 1 as hit
          from order_materials
          inner join orders on orders.id = order_materials.order_id
          where order_materials.ingredient_id = ${id} and orders.status = 'confirmed'
          limit 1
        `)
      : await db.all(sql`
          select 1 as hit
          from order_materials
          inner join orders on orders.id = order_materials.order_id
          where order_materials.kit_id = ${id} and orders.status = 'confirmed'
          limit 1
        `);
  return hasRows(rows);
}

async function columnNames(db: KitchenDatabase, table: OrderTable): Promise<Set<string>> {
  const rows = await db.all(sql.raw(`pragma table_info(${table})`));
  const names = new Set<string>();
  if (!Array.isArray(rows)) {
    return names;
  }
  for (const row of rows) {
    const name = pragmaColumnName(row);
    if (name) {
      names.add(name);
    }
  }
  return names;
}

function pragmaColumnName(row: unknown): string | null {
  if (Array.isArray(row)) {
    return typeof row[1] === "string" ? row[1] : null;
  }
  if (typeof row === "object" && row !== null && "name" in row) {
    const name = row.name;
    return typeof name === "string" ? name : null;
  }
  return null;
}

function hasRows(rows: unknown): boolean {
  return Array.isArray(rows) && rows.length > 0;
}
