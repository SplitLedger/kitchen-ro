// FIFO by acquired date, then lot id. Either every slice, or a shortfall.
// This function does not touch the database.

import type { LotSource } from "@/domain/inventory/prices";

export type AllocatableLot = {
  id: number;
  quantity: number;
  unitPrice: number;
  source: LotSource;
  note: string;
  acquiredOn: string;
};

export type AllocationSlice = {
  lotId: number;
  quantity: number;
  unitPrice: number;
  source: LotSource;
  note: string;
  acquiredOn: string;
};

export type AllocationResult =
  | { ok: true; slices: AllocationSlice[] }
  | { ok: false; shortfall: number };

export function allocateFifo(lots: readonly AllocatableLot[], need: number): AllocationResult {
  if (!Number.isInteger(need) || need < 0) {
    throw new Error("Quantity to allocate must be a whole number.");
  }
  if (need === 0) {
    return { ok: true, slices: [] };
  }

  const ordered = [...lots].sort((left, right) => {
    if (left.acquiredOn !== right.acquiredOn) {
      return left.acquiredOn < right.acquiredOn ? -1 : 1;
    }
    return left.id - right.id;
  });

  let remaining = need;
  const slices: AllocationSlice[] = [];
  for (const lot of ordered) {
    if (remaining === 0) {
      break;
    }
    if (!Number.isInteger(lot.quantity) || lot.quantity < 0) {
      throw new Error("Lot quantity must be a whole number.");
    }
    if (lot.quantity === 0) {
      continue;
    }
    const take = Math.min(lot.quantity, remaining);
    slices.push({
      lotId: lot.id,
      quantity: take,
      unitPrice: lot.unitPrice,
      source: lot.source,
      note: lot.note,
      acquiredOn: lot.acquiredOn,
    });
    remaining -= take;
  }

  if (remaining > 0) {
    return { ok: false, shortfall: remaining };
  }
  return { ok: true, slices };
}
