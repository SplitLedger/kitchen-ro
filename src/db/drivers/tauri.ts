import Database from "@tauri-apps/plugin-sql";
import type { SqlExecutor } from "../executor";

const databasePath = "sqlite:kitchen-ro.db";

export async function createTauriExecutor(): Promise<SqlExecutor> {
  // Drizzle and sql.js use `?` placeholders. sqlx binds those in order for SQLite.
  const database = await Database.load(databasePath);

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
