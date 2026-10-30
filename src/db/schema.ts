import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { foodStats } from "@/domain/catalog/food-stat";

export const catalogOrigins = ["official", "custom"] as const;
export type CatalogOrigin = (typeof catalogOrigins)[number];

export const settings = sqliteTable(
  "settings",
  {
    id: integer("id").primaryKey(),
    baseLevel: integer("base_level").notNull().default(99),
    dex: integer("dex").notNull().default(99),
    luk: integer("luk").notNull().default(1),
    mastery: integer("mastery").notNull().default(0),
    defaultKitKey: text("default_kit_key").notNull().default("outdoor"),
    marginPercent: integer("margin_percent").notNull().default(20),
    currencyLabel: text("currency_label").notNull().default("zeny"),
    planningMode: text("planning_mode", { enum: ["expected", "conservative"] })
      .notNull()
      .default("expected"),
    theme: text("theme", { enum: ["light", "dark"] })
      .notNull()
      .default("dark"),
  },
  (table) => [
    check("settings_singleton", sql`${table.id} = 1`),
    check("settings_theme", sql`${table.theme} in ('light', 'dark')`),
    check("settings_planning_mode", sql`${table.planningMode} in ('expected', 'conservative')`),
  ],
);

export type Settings = typeof settings.$inferSelect;
export type ThemeName = Settings["theme"];
export type PlanningMode = Settings["planningMode"];

export const ingredients = sqliteTable(
  "ingredients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    seedKey: text("seed_key").unique(),
    name: text("name").notNull(),
    origin: text("origin", { enum: catalogOrigins }).notNull(),
    referencePrice: integer("reference_price"),
    unitValue: integer("unit_value"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [check("ingredients_origin", sql`${table.origin} in ('official', 'custom')`)],
);

export const cookingKits = sqliteTable(
  "cooking_kits",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    seedKey: text("seed_key").unique(),
    name: text("name").notNull(),
    produceValue: integer("produce_value").notNull(),
    alwaysSuccess: integer("always_success", { mode: "boolean" }).notNull().default(false),
    origin: text("origin", { enum: catalogOrigins }).notNull(),
    referencePrice: integer("reference_price"),
    unitValue: integer("unit_value"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [check("cooking_kits_origin", sql`${table.origin} in ('official', 'custom')`)],
);

export const recipes = sqliteTable(
  "recipes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    seedKey: text("seed_key").unique(),
    name: text("name").notNull(),
    stat: text("stat", { enum: foodStats }).notNull(),
    level: integer("level").notNull(),
    weight: integer("weight").notNull(),
    hpRegen: integer("hp_regen").notNull(),
    spRegen: integer("sp_regen").notNull(),
    statBonus: integer("stat_bonus").notNull(),
    cookbookLabel: text("cookbook_label").notNull(),
    origin: text("origin", { enum: catalogOrigins }).notNull(),
    diverged: integer("diverged", { mode: "boolean" }).notNull().default(false),
    salePriceOverride: integer("sale_price_override"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    check("recipes_origin", sql`${table.origin} in ('official', 'custom')`),
    check("recipes_stat", sql`${table.stat} in ('str', 'agi', 'vit', 'int', 'dex', 'luk')`),
  ],
);

export const recipeItems = sqliteTable(
  "recipe_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    ingredientId: integer("ingredient_id")
      .notNull()
      .references(() => ingredients.id),
    quantity: integer("quantity").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    unique("recipe_items_recipe_position").on(table.recipeId, table.position),
    unique("recipe_items_recipe_ingredient").on(table.recipeId, table.ingredientId),
    check("recipe_items_quantity", sql`${table.quantity} >= 1`),
  ],
);

export type Ingredient = typeof ingredients.$inferSelect;
export type CookingKit = typeof cookingKits.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type RecipeItem = typeof recipeItems.$inferSelect;
