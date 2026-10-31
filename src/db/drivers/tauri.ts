import Database from "@tauri-apps/plugin-sql";
import type { SqlExecutor } from "../executor";

const databasePath = "sqlite:kitchen-ro.db";

let active: Database | null = null;

export async function closeTauriDatabase(): Promise<void> {
  const database = active;
  active = null;
  if (!database) {
    return;
  }
  await database.close(databasePath);
}

export async function createTauriExecutor(): Promise<SqlExecutor> {
  // Drizzle and sql.js use `?` placeholders. sqlx binds those in order for SQLite.
  const database = await Database.load(databasePath);
  active = database;

  return {
    async execute(sql, params = []) {
      await database.execute(sql, [...params]);
    },
    async select<T extends Record<string, unknown>>(sql: string, params: readonly unknown[] = []) {
      const rows = await database.select<T[]>(sql, [...params]);
      return rows;
    },
  };
}
