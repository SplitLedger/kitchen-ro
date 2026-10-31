import { readFile } from "node:fs/promises";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { expect, test } from "vitest";
import { assertKitchenSchema, assertSqliteHeader, BackupError } from "./backup";
import { createKitchenDatabase } from "./client";
import { createSqlJsExecutor } from "./drivers/sqljs";
import { migrate } from "./migrate";
import { ensureSettings } from "./settings";
import { seedOfficialCatalog } from "./seed-catalog";

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

test("a seeded database is a Kitchen RO backup", async () => {
  const SQL = await loadSqlModule();
  const database = new SQL.Database();
  const executor = createSqlJsExecutor(database);
  await executor.execute("PRAGMA foreign_keys = ON");
  await migrate(executor);
  const db = createKitchenDatabase(executor);
  await ensureSettings(db);
  await seedOfficialCatalog(db);

  const bytes = database.export();
  expect(() => {
    assertSqliteHeader(bytes);
  }).not.toThrow();
  expect(() => {
    assertKitchenSchema(database);
  }).not.toThrow();
});

test("rejects a file that is not this app's database", async () => {
  expect(() => {
    assertSqliteHeader(new Uint8Array([1, 2, 3]));
  }).toThrow(BackupError);

  const SQL = await loadSqlModule();
  const database = new SQL.Database();
  database.run("CREATE TABLE settings (id integer)");
  assertSqliteHeader(database.export());
  expect(() => {
    assertKitchenSchema(database);
  }).toThrow(/not a Kitchen RO database/);
  database.close();
});
