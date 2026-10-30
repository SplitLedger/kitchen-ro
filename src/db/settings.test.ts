import { readFile } from "node:fs/promises";
import initSqlJs, { type SqlJsDatabase, type SqlJsStatic } from "sql.js";
import { expect, test } from "vitest";
import { createKitchenDatabase } from "./client";
import { createSqlJsExecutor } from "./drivers/sqljs";
import { migrate, splitSqlStatements } from "./migrate";
import { settings } from "./schema";
import { ensureSettings, readSettings, updateTheme } from "./settings";

let sqlModule: Promise<SqlJsStatic> | null = null;

function loadSqlModule(): Promise<SqlJsStatic> {
  sqlModule ??= readFile(
    new URL("../../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url),
  ).then((wasm) =>
    initSqlJs({
      wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength),
    }),
  );
  return sqlModule;
}

async function openMemoryDatabase(): Promise<SqlJsDatabase> {
  const SQL = await loadSqlModule();
  return new SQL.Database();
}

test("splits drizzle migration files on statement breakpoints", () => {
  expect(splitSqlStatements("select 1;\n--> statement-breakpoint\n\nselect 2;")).toEqual([
    "select 1;",
    "select 2;",
  ]);
});

test("creates one settings row and keeps later edits", async () => {
  const database = await openMemoryDatabase();
  const executor = createSqlJsExecutor(database);
  await migrate(executor);
  await migrate(executor);

  const db = createKitchenDatabase(executor);
  const created = await ensureSettings(db);
  expect(created).toMatchObject({
    id: 1,
    baseLevel: 99,
    dex: 99,
    luk: 1,
    mastery: 0,
    defaultKitKey: "outdoor",
    marginPercent: 20,
    currencyLabel: "zeny",
    planningMode: "expected",
    theme: "dark",
  });

  await updateTheme(db, "light");
  const kept = await ensureSettings(db);
  expect(kept.theme).toBe("light");

  const rows = await db.select().from(settings);
  expect(rows).toHaveLength(1);
  await expect(db.insert(settings).values({ id: 2 })).rejects.toThrow();

  const SQL = await loadSqlModule();
  const reopened = new SQL.Database(database.export());
  const reloaded = createKitchenDatabase(createSqlJsExecutor(reopened));
  expect((await readSettings(reloaded)).theme).toBe("light");
});

test("persists sql.js bytes only after a transaction commits", async () => {
  const database = await openMemoryDatabase();
  const writes: Uint8Array[] = [];
  const executor = createSqlJsExecutor(database, {
    persist: async () => {
      writes.push(database.export());
    },
  });

  await executor.execute("CREATE TABLE sample (id integer)");
  expect(writes).toHaveLength(1);

  await executor.execute("BEGIN");
  await executor.execute("INSERT INTO sample (id) VALUES (1)");
  expect(writes).toHaveLength(1);
  await executor.execute("ROLLBACK");
  expect(writes).toHaveLength(2);

  const rows = await executor.select<{ id: number }>("SELECT id FROM sample");
  expect(rows).toEqual([]);
});
