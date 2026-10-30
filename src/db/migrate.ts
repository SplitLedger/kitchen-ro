import journalJson from "../../drizzle/meta/_journal.json";
import type { SqlExecutor } from "./executor";

type MigrationJournal = {
  entries: Array<{
    idx: number;
    tag: string;
    when: number;
  }>;
};

const journal = journalJson as MigrationJournal;

const migrationSql = import.meta.glob("../../drizzle/*.sql", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

export function splitSqlStatements(sqlText: string): string[] {
  return sqlText
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

function sqlForTag(tag: string): string {
  const match = Object.entries(migrationSql).find(([path]) => path.endsWith(`/${tag}.sql`));
  const sqlText = match?.[1];
  if (!sqlText) {
    throw new Error(`Missing migration file for ${tag}.`);
  }
  return sqlText;
}

export async function migrate(executor: SqlExecutor): Promise<void> {
  await executor.execute(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id integer PRIMARY KEY AUTOINCREMENT,
      hash text NOT NULL UNIQUE,
      created_at integer
    )
  `);

  const applied = await executor.select<{ hash: string }>(
    'SELECT hash FROM "__drizzle_migrations"',
  );
  const appliedHashes = new Set(applied.map((row) => String(row.hash)));
  const entries = [...journal.entries].sort((left, right) => left.idx - right.idx);

  for (const entry of entries) {
    if (appliedHashes.has(entry.tag)) {
      continue;
    }

    const statements = splitSqlStatements(sqlForTag(entry.tag));
    await executor.execute("BEGIN");
    try {
      for (const statement of statements) {
        await executor.execute(statement);
      }
      await executor.execute(
        'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)',
        [entry.tag, entry.when],
      );
      await executor.execute("COMMIT");
    } catch (error) {
      await executor.execute("ROLLBACK");
      throw error;
    }
  }
}
