// A lot still on hand is the price. Quantity 0 does not count.
// Average is the quantity-weighted mean, rounded half up.
// No remaining lots means there is no unit price.

export const lotSources = ["bought", "farmed"] as const;
export type LotSource = (typeof lotSources)[number];

export const priceBases = ["minimum", "average", "maximum"] as const;
export type PriceBasis = (typeof priceBases)[number];

export const priceBasisLabels: Record<PriceBasis, string> = {
  minimum: "Minimum",
  average: "Average",
  maximum: "Maximum",
};

export type PricedLot = {
  quantity: number;
  unitPrice: number;
};

export type LotPriceSummary = {
  onHand: number;
  minimum: number;
  average: number;
  maximum: number;
};

export type PriceBook = {
  ingredients: Readonly<Record<number, LotPriceSummary>>;
  kits: Readonly<Record<number, LotPriceSummary>>;
};

export function isPriceBasis(value: string): value is PriceBasis {
  return (priceBases as readonly string[]).includes(value);
}

export function isLotSource(value: string): value is LotSource {
  return (lotSources as readonly string[]).includes(value);
}

export function emptyPriceBook(): PriceBook {
  return { ingredients: {}, kits: {} };
}

export function summarizeLotPrices(lots: readonly PricedLot[]): LotPriceSummary | null {
  const held = lots.filter((lot) => lot.quantity > 0);
  const first = held[0];
  if (!first) {
    return null;
  }

  let onHand = 0;
  let weighted = 0;
  let minimum = first.unitPrice;
  let maximum = first.unitPrice;

  for (const lot of held) {
    if (!Number.isInteger(lot.quantity) || !Number.isInteger(lot.unitPrice) || lot.unitPrice < 0) {
      throw new Error("Lot price inputs must be whole numbers.");
    }
    const extension = lot.quantity * lot.unitPrice;
    if (
      !Number.isSafeInteger(onHand + lot.quantity) ||
      !Number.isSafeInteger(weighted + extension)
    ) {
      throw new Error("Inventory price is too large.");
    }
    onHand += lot.quantity;
    weighted += extension;
    if (lot.unitPrice < minimum) {
      minimum = lot.unitPrice;
    }
    if (lot.unitPrice > maximum) {
      maximum = lot.unitPrice;
    }
  }

  return {
    onHand,
    minimum,
    average: roundHalfUp(weighted, onHand),
    maximum,
  };
}

export function unitPriceForBasis(
  summary: LotPriceSummary | null,
  basis: PriceBasis,
): number | null {
  if (!summary) {
    return null;
  }
  return summary[basis];
}

export function lookupSummary(
  book: PriceBook,
  kind: "ingredient" | "kit",
  id: number | null,
): LotPriceSummary | null {
  if (id === null) {
    return null;
  }
  return (kind === "ingredient" ? book.ingredients : book.kits)[id] ?? null;
}

export function priceBookFromLots(
  lots: readonly {
    ingredientId: number | null;
    kitId: number | null;
    quantity: number;
    unitPrice: number;
  }[],
): PriceBook {
  const ingredients = new Map<number, PricedLot[]>();
  const kits = new Map<number, PricedLot[]>();
  for (const lot of lots) {
    const priced = { quantity: lot.quantity, unitPrice: lot.unitPrice };
    if (lot.ingredientId !== null) {
      const group = ingredients.get(lot.ingredientId) ?? [];
      group.push(priced);
      ingredients.set(lot.ingredientId, group);
    }
    if (lot.kitId !== null) {
      const group = kits.get(lot.kitId) ?? [];
      group.push(priced);
      kits.set(lot.kitId, group);
    }
  }
  return { ingredients: toSummaries(ingredients), kits: toSummaries(kits) };
}

function toSummaries(groups: Map<number, PricedLot[]>): Record<number, LotPriceSummary> {
  const book: Record<number, LotPriceSummary> = {};
  for (const [id, lots] of groups) {
    const summary = summarizeLotPrices(lots);
    if (summary) {
      book[id] = summary;
    }
  }
  return book;
}

function roundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}
