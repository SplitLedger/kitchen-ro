import { drizzle, type SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import type { SqlExecutor } from "./executor";
import * as schema from "./schema";

export type KitchenDatabase = SqliteRemoteDatabase<typeof schema>;

export function createKitchenDatabase(executor: SqlExecutor): KitchenDatabase {
  return drizzle(
    async (sql, params, method) => {
      if (method === "run") {
        await executor.execute(sql, params);
        return { rows: [] };
      }

      const records = await executor.select(sql, params);
      const rows = records.map((record) => Object.values(record));
      if (method === "get") {
        return { rows: (rows[0] ?? null) as unknown[] };
      }
      return { rows };
    },
    { schema },
  );
}
