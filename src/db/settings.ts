import { eq } from "drizzle-orm";
import { assertCookProfile, type CookProfileDraft } from "@/domain/cooking/profile";
import { isPriceBasis, type PriceBasis } from "@/domain/inventory/prices";
import { assertPricingSettings, type PricingSettingsDraft } from "@/domain/pricing/cost";
import { listCookingKits } from "./catalog";
import type { KitchenDatabase } from "./client";
import { settings, type PlanningMode, type Settings, type ThemeName } from "./schema";

export async function readSettings(db: KitchenDatabase): Promise<Settings> {
  const rows = await db.select().from(settings).where(eq(settings.id, 1));
  const row = rows[0];
  if (!row) {
    throw new Error("The settings row is missing.");
  }
  return row;
}

export async function ensureSettings(db: KitchenDatabase): Promise<Settings> {
  const existing = await db.select().from(settings).where(eq(settings.id, 1));
  if (existing[0]) {
    return existing[0];
  }

  await db.insert(settings).values({ id: 1 });
  return readSettings(db);
}

export async function updateTheme(db: KitchenDatabase, theme: ThemeName): Promise<Settings> {
  await db.update(settings).set({ theme }).where(eq(settings.id, 1));
  return readSettings(db);
}

export async function updatePricingSettings(
  db: KitchenDatabase,
  draft: PricingSettingsDraft,
): Promise<Settings> {
  const pricing = assertPricingSettings(draft);
  await db.update(settings).set(pricing).where(eq(settings.id, 1));
  return readSettings(db);
}

export async function updatePlanningMode(
  db: KitchenDatabase,
  planningMode: PlanningMode,
): Promise<Settings> {
  if (planningMode !== "expected" && planningMode !== "conservative") {
    throw new Error("Choose Expected or Conservative.");
  }
  await db.update(settings).set({ planningMode }).where(eq(settings.id, 1));
  return readSettings(db);
}

export async function updatePriceBasis(
  db: KitchenDatabase,
  priceBasis: PriceBasis,
): Promise<Settings> {
  if (!isPriceBasis(priceBasis)) {
    throw new Error("Choose a minimum, average, or maximum price.");
  }
  await db.update(settings).set({ priceBasis }).where(eq(settings.id, 1));
  return readSettings(db);
}

export async function updateCookProfile(
  db: KitchenDatabase,
  draft: CookProfileDraft,
): Promise<Settings> {
  const kits = await listCookingKits(db);
  const profile = assertCookProfile(draft, kits);
  await db.update(settings).set(profile).where(eq(settings.id, 1));
  return readSettings(db);
}
