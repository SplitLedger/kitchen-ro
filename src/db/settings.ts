import { eq } from "drizzle-orm";
import type { KitchenDatabase } from "./client";
import { settings, type Settings, type ThemeName } from "./schema";

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
