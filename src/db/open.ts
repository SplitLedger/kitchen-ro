import { createKitchenDatabase, type KitchenDatabase } from "./client";
import type { SqlExecutor } from "./executor";
import { migrate } from "./migrate";
import { ensureSettings, readSettings, updateTheme } from "./settings";
import type { Settings, ThemeName } from "./schema";

export type AppDatabase = {
  db: KitchenDatabase;
  readSettings(): Promise<Settings>;
  updateTheme(theme: ThemeName): Promise<Settings>;
};

let opening: Promise<AppDatabase> | null = null;

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

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
  const db = createKitchenDatabase(executor);
  await ensureSettings(db);

  return {
    db,
    readSettings: () => readSettings(db),
    updateTheme: (theme) => updateTheme(db, theme),
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
