import { DateTime } from "luxon";
import { isLotSource, type LotSource } from "@/domain/inventory/prices";

export const LOT_NOTE_MAX = 200;
export const LOT_AMOUNT_MAX = 999_999_999;

export class InventoryLotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryLotError";
  }
}

export function todayIsoDate(now: DateTime = DateTime.now()): string {
  const iso = now.toISODate();
  if (!iso) {
    throw new InventoryLotError("Could not read today's date.");
  }
  return iso;
}

export function parseLotQuantity(value: string, mode: "create" | "edit"): number {
  return assertLotQuantity(parseWhole(value, "Quantity"), mode);
}

export function assertLotQuantity(value: number, mode: "create" | "edit"): number {
  const minimum = mode === "create" ? 1 : 0;
  if (!Number.isSafeInteger(value) || value < 0 || value > LOT_AMOUNT_MAX) {
    throw new InventoryLotError(
      value > LOT_AMOUNT_MAX ? "Quantity is too large." : "Quantity must be a whole number.",
    );
  }
  if (value < minimum) {
    throw new InventoryLotError(
      mode === "create" ? "Quantity must be at least 1." : "Quantity must be a whole number.",
    );
  }
  return value;
}

export function parseLotUnitPrice(value: string): number {
  return assertLotUnitPrice(parseWhole(value, "Unit price"));
}

export function assertLotUnitPrice(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > LOT_AMOUNT_MAX) {
    throw new InventoryLotError(
      value > LOT_AMOUNT_MAX ? "Unit price is too large." : "Unit price must be a whole number.",
    );
  }
  return value;
}

export function parseLotSource(value: string): LotSource {
  if (!isLotSource(value)) {
    throw new InventoryLotError("Choose bought or farmed.");
  }
  return value;
}

export function parseAcquiredOn(value: string): string {
  const trimmed = value.trim();
  const parsed = DateTime.fromISO(trimmed);
  if (!parsed.isValid || parsed.toISODate() !== trimmed) {
    throw new InventoryLotError("Acquired date must be a real date.");
  }
  return trimmed;
}

export function parseLotNote(value: string): string {
  const note = value.trim();
  if (note.length > LOT_NOTE_MAX) {
    throw new InventoryLotError(`Note must be ${LOT_NOTE_MAX} characters or fewer.`);
  }
  return note;
}

export function lotMessage(check: () => unknown): string | undefined {
  try {
    check();
    return undefined;
  } catch (error) {
    if (error instanceof InventoryLotError) {
      return error.message;
    }
    throw error;
  }
}

function parseWhole(value: string, label: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new InventoryLotError(`${label} is required.`);
  }
  if (!/^\d+$/.test(trimmed)) {
    throw new InventoryLotError(`${label} must be a whole number.`);
  }
  return Number(trimmed);
}
