import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import initSqlJs, { type SqlJsDatabase, type SqlJsStatic } from "sql.js";
import { expect, test } from "vitest";
import { createKitchenDatabase } from "./client";
import { createSqlJsExecutor } from "./drivers/sqljs";
import { migrate, splitSqlStatements } from "./migrate";
import { cookingKits, settings } from "./schema";
import {
  ensureSettings,
  readSettings,
  updateCookProfile,
  updatePricingSettings,
  updateTheme,
} from "./settings";

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
    priceBasis: "average",
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

test("saves the cook profile on the settings row", async () => {
  const database = await openMemoryDatabase();
  const executor = createSqlJsExecutor(database);
  await migrate(executor);
  const db = createKitchenDatabase(executor);
  await ensureSettings(db);
  await db.insert(cookingKits).values([
    {
      seedKey: "outdoor",
      name: "Outdoor Cooking Kit",
      produceValue: 11,
      alwaysSuccess: false,
      origin: "official",
    },
    {
      name: "Camp Kit",
      produceValue: 12,
      alwaysSuccess: false,
      origin: "custom",
    },
    {
      seedKey: "royal",
      name: "Royal Cooking Kit",
      produceValue: 14,
      alwaysSuccess: false,
      origin: "official",
      archived: true,
    },
  ]);
  const [custom] = await db.select().from(cookingKits).where(eq(cookingKits.name, "Camp Kit"));
  if (!custom) {
    throw new Error("Camp Kit was not inserted.");
  }

  const saved = await updateCookProfile(db, {
    baseLevel: 99,
    dex: 90,
    luk: 50,
    mastery: 80,
    defaultKitKey: "outdoor",
  });
  expect(saved).toMatchObject({
    id: 1,
    baseLevel: 99,
    dex: 90,
    luk: 50,
    mastery: 80,
    defaultKitKey: "outdoor",
  });

  const customSaved = await updateCookProfile(db, {
    baseLevel: 0,
    dex: 999,
    luk: 999,
    mastery: 1999,
    defaultKitKey: `kit:${custom.id}`,
  });
  expect(customSaved).toMatchObject({
    id: 1,
    baseLevel: 0,
    dex: 999,
    luk: 999,
    mastery: 1999,
    defaultKitKey: `kit:${custom.id}`,
  });

  await expect(
    updateCookProfile(db, {
      baseLevel: 99,
      dex: 99,
      luk: 1,
      mastery: 0,
      defaultKitKey: "royal",
    }),
  ).rejects.toThrow(/cooking kit/i);
  await expect(
    updateCookProfile(db, {
      baseLevel: 1000,
      dex: 99,
      luk: 1,
      mastery: 0,
      defaultKitKey: "outdoor",
    }),
  ).rejects.toThrow(/0 to 999/);

  const rows = await db.select().from(settings);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.defaultKitKey).toBe(`kit:${custom.id}`);
});

test("saves margin and currency without changing the cook profile", async () => {
  const database = await openMemoryDatabase();
  const executor = createSqlJsExecutor(database);
  await migrate(executor);
  const db = createKitchenDatabase(executor);
  await ensureSettings(db);

  const saved = await updatePricingSettings(db, { marginPercent: 35, currencyLabel: " z " });
  expect(saved).toMatchObject({
    id: 1,
    baseLevel: 99,
    dex: 99,
    luk: 1,
    mastery: 0,
    defaultKitKey: "outdoor",
    marginPercent: 35,
    currencyLabel: "z",
    planningMode: "expected",
    priceBasis: "average",
    theme: "dark",
  });

  await expect(
    updatePricingSettings(db, { marginPercent: 1000, currencyLabel: "zeny" }),
  ).rejects.toThrow(/0 to 999/);
  await expect(
    updatePricingSettings(db, { marginPercent: 20, currencyLabel: "   " }),
  ).rejects.toThrow(/required/i);

  const [row] = await db.select().from(settings);
  expect(row).toMatchObject({ marginPercent: 35, currencyLabel: "z", baseLevel: 99 });
});
