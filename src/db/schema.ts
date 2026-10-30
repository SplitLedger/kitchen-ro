import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
