import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { foodStats } from "@/domain/catalog/food-stat";
import { lotSources, priceBases } from "@/domain/inventory/prices";

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
    priceBasis: text("price_basis", { enum: priceBases }).notNull().default("average"),
    theme: text("theme", { enum: ["light", "dark"] })
      .notNull()
      .default("dark"),
  },
  (table) => [
    check("settings_singleton", sql`${table.id} = 1`),
    check("settings_theme", sql`${table.theme} in ('light', 'dark')`),
    check("settings_planning_mode", sql`${table.planningMode} in ('expected', 'conservative')`),
    check("settings_price_basis", sql`${table.priceBasis} in ('minimum', 'average', 'maximum')`),
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

export const orderStatuses = ["draft", "confirmed", "done", "cancelled"] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const orderSaleSources = ["margin", "recipe", "line"] as const;
export type OrderSaleSource = (typeof orderSaleSources)[number];

export const orderMaterialKinds = ["ingredient", "kit"] as const;
export type OrderMaterialKind = (typeof orderMaterialKinds)[number];

export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    customerName: text("customer_name").notNull().default(""),
    notes: text("notes").notNull().default(""),
    status: text("status", { enum: orderStatuses }).notNull().default("draft"),
    planningMode: text("planning_mode", { enum: ["expected", "conservative"] })
      .notNull()
      .default("expected"),
    priceBasis: text("price_basis", { enum: priceBases }).notNull().default("average"),
    kitId: integer("kit_id").references(() => cookingKits.id, { onDelete: "set null" }),
    kitName: text("kit_name").notNull(),
    produceValue: integer("produce_value").notNull(),
    alwaysSuccess: integer("always_success", { mode: "boolean" }).notNull(),
    baseLevel: integer("base_level").notNull(),
    dex: integer("dex").notNull(),
    luk: integer("luk").notNull(),
    mastery: integer("mastery").notNull(),
    marginPercent: integer("margin_percent").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    confirmedAt: text("confirmed_at"),
  },
  (table) => [
    check("orders_status", sql`${table.status} in ('draft', 'confirmed', 'done', 'cancelled')`),
    check("orders_planning_mode", sql`${table.planningMode} in ('expected', 'conservative')`),
    check("orders_price_basis", sql`${table.priceBasis} in ('minimum', 'average', 'maximum')`),
  ],
);

export const orderLines = sqliteTable(
  "order_lines",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    recipeId: integer("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    stat: text("stat", { enum: foodStats }).notNull(),
    level: integer("level").notNull(),
    ingredientCount: integer("ingredient_count").notNull(),
    quantity: integer("quantity").notNull(),
    minRateBp: integer("min_rate_bp"),
    avgRateBp: integer("avg_rate_bp"),
    maxRateBp: integer("max_rate_bp"),
    usedRateBp: integer("used_rate_bp"),
    attempts: integer("attempts"),
    oneAttemptCost: integer("one_attempt_cost"),
    unitCost: integer("unit_cost"),
    unitSale: integer("unit_sale"),
    saleSource: text("sale_source", { enum: orderSaleSources }),
    saleOverride: integer("sale_override"),
  },
  (table) => [
    unique("order_lines_order_position").on(table.orderId, table.position),
    check("order_lines_quantity", sql`${table.quantity} >= 1`),
    check("order_lines_stat", sql`${table.stat} in ('str', 'agi', 'vit', 'int', 'dex', 'luk')`),
    check(
      "order_lines_sale_source",
      sql`${table.saleSource} is null or ${table.saleSource} in ('margin', 'recipe', 'line')`,
    ),
  ],
);

export const orderMaterials = sqliteTable(
  "order_materials",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    kind: text("kind", { enum: orderMaterialKinds }).notNull(),
    ingredientId: integer("ingredient_id").references(() => ingredients.id, {
      onDelete: "set null",
    }),
    kitId: integer("kit_id").references(() => cookingKits.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull(),
    unitValue: integer("unit_value"),
    extendedCost: integer("extended_cost"),
  },
  (table) => [
    unique("order_materials_order_position").on(table.orderId, table.position),
    check("order_materials_kind", sql`${table.kind} in ('ingredient', 'kit')`),
    check("order_materials_quantity", sql`${table.quantity} >= 1`),
  ],
);

export const inventoryLots = sqliteTable(
  "inventory_lots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ingredientId: integer("ingredient_id").references(() => ingredients.id, {
      onDelete: "restrict",
    }),
    kitId: integer("kit_id").references(() => cookingKits.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    source: text("source", { enum: lotSources }).notNull(),
    acquiredOn: text("acquired_on").notNull(),
    note: text("note").notNull().default(""),
  },
  (table) => [
    check("inventory_lots_quantity", sql`${table.quantity} >= 0`),
    check("inventory_lots_unit_price", sql`${table.unitPrice} >= 0`),
    check("inventory_lots_source", sql`${table.source} in ('bought', 'farmed')`),
    check(
      "inventory_lots_owner",
      sql`(
        (${table.ingredientId} is not null and ${table.kitId} is null) or
        (${table.ingredientId} is null and ${table.kitId} is not null)
      )`,
    ),
  ],
);

export const orderAllocations = sqliteTable(
  "order_allocations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    lotId: integer("lot_id").references(() => inventoryLots.id, { onDelete: "set null" }),
    ingredientId: integer("ingredient_id").references(() => ingredients.id, {
      onDelete: "restrict",
    }),
    kitId: integer("kit_id").references(() => cookingKits.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    source: text("source", { enum: lotSources }).notNull(),
    acquiredOn: text("acquired_on").notNull(),
    note: text("note").notNull().default(""),
  },
  (table) => [
    check("order_allocations_quantity", sql`${table.quantity} >= 1`),
    check("order_allocations_unit_price", sql`${table.unitPrice} >= 0`),
    check("order_allocations_source", sql`${table.source} in ('bought', 'farmed')`),
    check(
      "order_allocations_owner",
      sql`(
        (${table.ingredientId} is not null and ${table.kitId} is null) or
        (${table.ingredientId} is null and ${table.kitId} is not null)
      )`,
    ),
  ],
);

export type Ingredient = typeof ingredients.$inferSelect;
export type CookingKit = typeof cookingKits.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type RecipeItem = typeof recipeItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderLine = typeof orderLines.$inferSelect;
export type OrderMaterial = typeof orderMaterials.$inferSelect;
export type InventoryLot = typeof inventoryLots.$inferSelect;
export type OrderAllocation = typeof orderAllocations.$inferSelect;
