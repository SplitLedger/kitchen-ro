import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { expect, test } from "vitest";
import journalJson from "../../drizzle/meta/_journal.json";
import { createKitchenDatabase, type KitchenDatabase } from "./client";
import { createSqlJsExecutor } from "./drivers/sqljs";
import { createLot, deleteLot, loadPriceBook, updateLot } from "./inventory";
import { splitSqlStatements } from "./migrate";
import { cookingKits, ingredients, inventoryLots } from "./schema";
import { ensureSettings, readSettings } from "./settings";
import { seedOfficialCatalog } from "./seed-catalog";

type Journal = { entries: Array<{ tag: string }> };
const journal = journalJson as Journal;

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

test("imports a typed unit price as one bought lot and drops the column", async () => {
  const SQL = await loadSqlModule();
  const database = new SQL.Database();
  const executor = createSqlJsExecutor(database);
  await executor.execute("PRAGMA foreign_keys = ON");
  await applyUntil(executor, "0004_orders");
  await executor.execute(
    "INSERT INTO ingredients (name, origin, reference_price, unit_value, archived) VALUES ('Herb', 'custom', NULL, 40, 0)",
  );
  await executor.execute(
    "INSERT INTO ingredients (name, origin, reference_price, unit_value, archived) VALUES ('Gift', 'custom', NULL, 0, 0)",
  );
  await executor.execute(
    "INSERT INTO ingredients (name, origin, reference_price, unit_value, archived) VALUES ('Free', 'custom', NULL, NULL, 0)",
  );
  await executor.execute(
    "INSERT INTO cooking_kits (name, produce_value, always_success, origin, reference_price, unit_value, archived) VALUES ('Camp', 11, 0, 'custom', NULL, 15, 0)",
  );
  await executor.execute(
    "INSERT INTO orders (customer_name, notes, status, planning_mode, kit_name, produce_value, always_success, base_level, dex, luk, mastery, margin_percent, created_at, updated_at) VALUES ('A', '', 'draft', 'expected', 'Camp', 11, 0, 99, 99, 1, 0, 20, 't', 't')",
  );
  await applyUntil(executor, "0005_inventory_lots", "0004_orders");

  const db = createKitchenDatabase(executor);
  const lots = await db.select().from(inventoryLots);
  expect(lots).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        quantity: 1,
        unitPrice: 40,
        source: "bought",
        note: "Imported from unit price",
        kitId: null,
      }),
      expect.objectContaining({
        quantity: 1,
        unitPrice: 0,
        source: "bought",
        note: "Imported from unit price",
      }),
      expect.objectContaining({
        quantity: 1,
        unitPrice: 15,
        source: "bought",
        ingredientId: null,
      }),
    ]),
  );
  expect(lots).toHaveLength(3);
  expect(lots.every((lot) => /^\d{4}-\d{2}-\d{2}$/.test(lot.acquiredOn))).toBe(true);

  const ingredientColumns = await executor.select<{ name: string }>(
    "pragma table_info(ingredients)",
  );
  expect(ingredientColumns.map((column) => column.name)).not.toContain("unit_value");
  const kitColumns = await executor.select<{ name: string }>("pragma table_info(cooking_kits)");
  expect(kitColumns.map((column) => column.name)).not.toContain("unit_value");

  const [order] = await executor.select<{ price_basis: string }>("select price_basis from orders");
  expect(order?.price_basis).toBe("average");
  await ensureSettings(db);
  expect((await readSettings(db)).priceBasis).toBe("average");

  const book = await loadPriceBook(db);
  const herb = lots.find((lot) => lot.unitPrice === 40);
  expect(book.ingredients[herb?.ingredientId ?? 0]).toEqual({
    onHand: 1,
    minimum: 40,
    average: 40,
    maximum: 40,
  });
});

test("adds, edits, and deletes a lot", async () => {
  const db = await openSeeded();
  const [oil] = await db.select().from(ingredients).where(eq(ingredients.seedKey, "cooking-oil"));
  const [outdoor] = await db.select().from(cookingKits).where(eq(cookingKits.seedKey, "outdoor"));
  if (!oil || !outdoor) {
    throw new Error("Missing a seeded ingredient or kit.");
  }

  const lotId = await createLot(db, {
    ingredientId: oil.id,
    kitId: null,
    quantity: 4,
    unitPrice: 0,
    source: "farmed",
    acquiredOn: "2026-10-31",
    note: " patch ",
  });
  await updateLot(db, lotId, {
    quantity: 0,
    unitPrice: 9,
    source: "bought",
    acquiredOn: "2026-10-30",
    note: "sold",
  });
  const [stored] = await db.select().from(inventoryLots).where(eq(inventoryLots.id, lotId));
  expect(stored).toMatchObject({
    quantity: 0,
    unitPrice: 9,
    source: "bought",
    acquiredOn: "2026-10-30",
    note: "sold",
  });
  expect(await loadPriceBook(db)).toEqual({ ingredients: {}, kits: {} });

  await expect(
    createLot(db, {
      ingredientId: oil.id,
      kitId: outdoor.id,
      quantity: 1,
      unitPrice: 1,
      source: "bought",
      acquiredOn: "2026-10-31",
      note: "",
    }),
  ).rejects.toThrow(/ingredient or a cooking kit/i);
  await expect(
    createLot(db, {
      ingredientId: oil.id,
      kitId: null,
      quantity: 0,
      unitPrice: 1,
      source: "bought",
      acquiredOn: "2026-10-31",
      note: "",
    }),
  ).rejects.toThrow(/at least 1/i);
  await expect(
    createLot(db, {
      ingredientId: 999_999,
      kitId: null,
      quantity: 1,
      unitPrice: 1,
      source: "bought",
      acquiredOn: "2026-10-31",
      note: "",
    }),
  ).rejects.toThrow(/not in the catalog/i);

  await deleteLot(db, lotId);
  expect(await db.select().from(inventoryLots)).toEqual([]);
});

test("a returned insert is in the saved database", async () => {
  const SQL = await loadSqlModule();
  const database = new SQL.Database();
  let saved: Uint8Array | null = null;
  const executor = createSqlJsExecutor(database, {
    persist: async () => {
      saved = database.export();
    },
  });
  await executor.execute("PRAGMA foreign_keys = ON");
  const { migrate } = await import("./migrate");
  await migrate(executor);
  const db = createKitchenDatabase(executor);
  await ensureSettings(db);
  await seedOfficialCatalog(db);
  const [oil] = await db.select().from(ingredients).where(eq(ingredients.seedKey, "cooking-oil"));
  if (!oil) {
    throw new Error("Missing a seeded ingredient.");
  }

  saved = null;
  await createLot(db, {
    ingredientId: oil.id,
    kitId: null,
    quantity: 2,
    unitPrice: 7,
    source: "bought",
    acquiredOn: "2026-10-31",
    note: "",
  });

  expect(saved).not.toBeNull();
  const reopened = createKitchenDatabase(createSqlJsExecutor(new SQL.Database(saved!)));
  const lots = await reopened.select().from(inventoryLots);
  expect(lots).toEqual([
    expect.objectContaining({
      ingredientId: oil.id,
      quantity: 2,
      unitPrice: 7,
      source: "bought",
    }),
  ]);
});

async function openSeeded(): Promise<KitchenDatabase> {
  const SQL = await loadSqlModule();
  const database = new SQL.Database();
  const executor = createSqlJsExecutor(database);
  await executor.execute("PRAGMA foreign_keys = ON");
  const { migrate } = await import("./migrate");
  await migrate(executor);
  const db = createKitchenDatabase(executor);
  await ensureSettings(db);
  await seedOfficialCatalog(db);
  return db;
}

async function applyUntil(
  executor: { execute(sql: string, params?: readonly unknown[]): Promise<void> },
  tag: string,
  after?: string,
): Promise<void> {
  let started = after === undefined;
  for (const entry of journal.entries) {
    if (!started) {
      if (entry.tag === after) {
        started = true;
      }
      continue;
    }
    const sqlText = await readFile(
      new URL(`../../drizzle/${entry.tag}.sql`, import.meta.url),
      "utf8",
    );
    await executor.execute("BEGIN");
    try {
      for (const statement of splitSqlStatements(sqlText)) {
        await executor.execute(statement);
      }
      await executor.execute("COMMIT");
    } catch (error) {
      await executor.execute("ROLLBACK");
      throw error;
    }
    if (entry.tag === tag) {
      return;
    }
  }
  throw new Error(`Missing migration ${tag}.`);
}
