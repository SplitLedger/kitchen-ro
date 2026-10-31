import { asc, eq } from "drizzle-orm";
import {
  assertLotQuantity,
  assertLotUnitPrice,
  InventoryLotError,
  parseAcquiredOn,
  parseLotNote,
  parseLotSource,
} from "@/domain/inventory/lot";
import { priceBookFromLots, type PriceBook } from "@/domain/inventory/prices";
import type { KitchenDatabase } from "./client";
import { cookingKits, ingredients, inventoryLots, type InventoryLot } from "./schema";

export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
  }
}

export type NewLot = {
  ingredientId: number | null;
  kitId: number | null;
  quantity: number;
  unitPrice: number;
  source: string;
  acquiredOn: string;
  note: string;
};

export type LotUpdate = {
  quantity: number;
  unitPrice: number;
  source: string;
  acquiredOn: string;
  note: string;
};

export async function listInventoryLots(db: KitchenDatabase): Promise<InventoryLot[]> {
  return db
    .select()
    .from(inventoryLots)
    .orderBy(asc(inventoryLots.acquiredOn), asc(inventoryLots.id));
}

export async function loadPriceBook(db: KitchenDatabase): Promise<PriceBook> {
  const lots = await db
    .select({
      ingredientId: inventoryLots.ingredientId,
      kitId: inventoryLots.kitId,
      quantity: inventoryLots.quantity,
      unitPrice: inventoryLots.unitPrice,
    })
    .from(inventoryLots);
  return priceBookFromLots(lots);
}

export async function createLot(db: KitchenDatabase, draft: NewLot): Promise<number> {
  const prepared = await prepareNew(db, draft);
  const [created] = await db
    .insert(inventoryLots)
    .values(prepared)
    .returning({ id: inventoryLots.id });
  if (!created) {
    throw new InventoryError("Could not add the lot.");
  }
  return created.id;
}

export async function updateLot(
  db: KitchenDatabase,
  lotId: number,
  draft: LotUpdate,
): Promise<void> {
  await requireLot(db, lotId);
  await db
    .update(inventoryLots)
    .set(prepareFields(draft, "edit"))
    .where(eq(inventoryLots.id, lotId));
}

export async function deleteLot(db: KitchenDatabase, lotId: number): Promise<void> {
  await requireLot(db, lotId);
  await db.delete(inventoryLots).where(eq(inventoryLots.id, lotId));
}

async function prepareNew(db: KitchenDatabase, draft: NewLot) {
  const fields = prepareFields(draft, "create");
  if ((draft.ingredientId === null) === (draft.kitId === null)) {
    throw new InventoryError("Choose an ingredient or a cooking kit.");
  }
  if (draft.ingredientId !== null) {
    if (!Number.isInteger(draft.ingredientId) || draft.ingredientId < 1) {
      throw new InventoryError("Choose an ingredient.");
    }
    const [row] = await db
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(eq(ingredients.id, draft.ingredientId));
    if (!row) {
      throw new InventoryError("That ingredient is not in the catalog.");
    }
  }
  if (draft.kitId !== null) {
    if (!Number.isInteger(draft.kitId) || draft.kitId < 1) {
      throw new InventoryError("Choose a cooking kit.");
    }
    const [row] = await db
      .select({ id: cookingKits.id })
      .from(cookingKits)
      .where(eq(cookingKits.id, draft.kitId));
    if (!row) {
      throw new InventoryError("That cooking kit is not in the catalog.");
    }
  }
  return {
    ingredientId: draft.ingredientId,
    kitId: draft.kitId,
    ...fields,
  };
}

function prepareFields(draft: LotUpdate, mode: "create" | "edit") {
  try {
    return {
      quantity: assertLotQuantity(draft.quantity, mode),
      unitPrice: assertLotUnitPrice(draft.unitPrice),
      source: parseLotSource(draft.source),
      acquiredOn: parseAcquiredOn(draft.acquiredOn),
      note: parseLotNote(draft.note),
    };
  } catch (error) {
    if (error instanceof InventoryLotError) {
      throw new InventoryError(error.message);
    }
    throw error;
  }
}

async function requireLot(db: KitchenDatabase, lotId: number): Promise<InventoryLot> {
  if (!Number.isInteger(lotId) || lotId < 1) {
    throw new InventoryError("That lot is not in inventory.");
  }
  const [lot] = await db.select().from(inventoryLots).where(eq(inventoryLots.id, lotId));
  if (!lot) {
    throw new InventoryError("That lot is not in inventory.");
  }
  return lot;
}
