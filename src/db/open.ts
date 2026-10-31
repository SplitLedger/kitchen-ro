import { createKitchenDatabase, type KitchenDatabase } from "./client";
import type { SqlExecutor } from "./executor";
import { migrate } from "./migrate";
import { isTauriRuntime } from "./runtime";
import { seedOfficialCatalog } from "./seed-catalog";
import type { CookProfileDraft } from "@/domain/cooking/profile";
import type { PricingSettingsDraft } from "@/domain/pricing/cost";
import type { PriceBasis } from "@/domain/inventory/prices";
import {
  ensureSettings,
  readSettings,
  updateCookProfile,
  updatePlanningMode,
  updatePriceBasis,
  updatePricingSettings,
  updateTheme,
} from "./settings";
import type { PlanningMode, Settings, ThemeName } from "./schema";

export type AppDatabase = {
  db: KitchenDatabase;
  readSettings(): Promise<Settings>;
  updateTheme(theme: ThemeName): Promise<Settings>;
  updateCookProfile(draft: CookProfileDraft): Promise<Settings>;
  updatePricingSettings(draft: PricingSettingsDraft): Promise<Settings>;
  updatePlanningMode(planningMode: PlanningMode): Promise<Settings>;
  updatePriceBasis(priceBasis: PriceBasis): Promise<Settings>;
};

let opening: Promise<AppDatabase> | null = null;

async function createExecutor(): Promise<SqlExecutor> {
  if (isTauriRuntime()) {
    const { createTauriExecutor } = await import("./drivers/tauri");
    return createTauriExecutor();
  }
  const { createBrowserExecutor } = await import("./drivers/browser");
  return createBrowserExecutor();
}

async function openAppDatabaseOnce(): Promise<AppDatabase> {
  const executor = await createExecutor();
  await executor.execute("PRAGMA foreign_keys = ON");
  await migrate(executor);
  await executor.execute("PRAGMA foreign_keys = ON");
  const db = createKitchenDatabase(executor);
  await ensureSettings(db);
  await seedOfficialCatalog(db);

  return {
    db,
    readSettings: () => readSettings(db),
    updateTheme: (theme) => updateTheme(db, theme),
    updateCookProfile: (draft) => updateCookProfile(db, draft),
    updatePricingSettings: (draft) => updatePricingSettings(db, draft),
    updatePlanningMode: (planningMode) => updatePlanningMode(db, planningMode),
    updatePriceBasis: (priceBasis) => updatePriceBasis(db, priceBasis),
  };
}

export function openAppDatabase(): Promise<AppDatabase> {
  if (!opening) {
    opening = openAppDatabaseOnce().catch((error: unknown) => {
      opening = null;
      throw error;
    });
  }
  return opening;
}
