import type { SqlJsDatabase, SqlJsValue } from "sql.js";
import type { SqlExecutor } from "../executor";

type SqlJsOptions = {
  persist?: () => Promise<void>;
};

function bindParams(params: readonly unknown[] | undefined): SqlJsValue[] {
  return (params ?? []).map((value) => {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value === "string" || typeof value === "number" || value instanceof Uint8Array) {
      return value;
    }
    if (typeof value === "bigint") {
      return Number(value);
    }
    if (typeof value === "boolean") {
      return value ? 1 : 0;
    }
    throw new Error(`Cannot bind a SQL value of type ${typeof value}.`);
  });
}

function transactionEdge(sql: string): "begin" | "end" | null {
  const keyword = sql.trimStart().split(/\s+/, 1)[0]?.toLowerCase();
  if (keyword === "begin") {
    return "begin";
  }
  if (keyword === "commit" || keyword === "end" || keyword === "rollback") {
    return "end";
  }
  return null;
}

export function createSqlJsExecutor(
  database: SqlJsDatabase,
  options: SqlJsOptions = {},
): SqlExecutor {
  let transactionDepth = 0;

  return {
    async execute(sql, params) {
      database.run(sql, bindParams(params));
      const edge = transactionEdge(sql);
      if (edge === "begin") {
        transactionDepth += 1;
      } else if (edge === "end") {
        transactionDepth = Math.max(0, transactionDepth - 1);
      }
      if (transactionDepth === 0 && options.persist) {
        await options.persist();
      }
    },
    async select<T extends Record<string, unknown>>(sql: string, params?: readonly unknown[]) {
      const statement = database.prepare(sql);
      try {
        const bound = bindParams(params);
        if (bound.length > 0) {
          statement.bind(bound);
        }
        const columns = statement.getColumnNames();
        const rows: Record<string, unknown>[] = [];
        while (statement.step()) {
          const values = statement.get();
          const row: Record<string, unknown> = {};
          columns.forEach((column, index) => {
            row[column] = values[index] ?? null;
          });
          rows.push(row);
        }
        return rows as T[];
      } finally {
        statement.free();
      }
    },
  };
}
