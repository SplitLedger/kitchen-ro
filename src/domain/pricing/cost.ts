// Money is a whole number of the currency label.
// One success costs ceil(oneAttemptCost * 10000 / rateBp).
// The margin sale is ceil(unitCost * (100 + marginPercent) / 100).
// A recipe override replaces that sale. Null follows the margin.

import { RATE_MAX_BP, RATE_MIN_BP } from "@/domain/cooking/success";

export const MARGIN_PERCENT_MIN = 0;
export const MARGIN_PERCENT_MAX = 999;
export const CURRENCY_LABEL_MAX_LENGTH = 16;

const maxUnitValue = 999_999_999;

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingError";
  }
}

export type PricingSettingsDraft = {
  marginPercent: number;
  currencyLabel: string;
};

export type CostLine = {
  name: string;
  quantity: number;
  unitValue: number | null;
};

export type AttemptCost =
  | { status: "missing"; missingNames: readonly string[] }
  | { status: "ready"; total: number };

export type SaleSource = "margin" | "recipe";

export type ResolvedSale = {
  amount: number;
  source: SaleSource;
};

export type RateQuote = {
  rateBp: number;
  unitCost: number;
  marginSale: number;
  sale: number;
  saleSource: SaleSource;
};

export type FoodQuote = {
  oneAttemptCost: number;
  minimum: RateQuote;
  average: RateQuote;
};

export function attemptCost(lines: readonly CostLine[]): AttemptCost {
  const missingNames: string[] = [];
  let total = 0;

  for (const line of lines) {
    assertQuantity(line.quantity);
    if (line.unitValue === null) {
      if (!missingNames.includes(line.name)) {
        missingNames.push(line.name);
      }
      continue;
    }
    const unitValue = assertCappedMoney(line.unitValue, "Unit value");
    const extended = line.quantity * unitValue;
    if (!Number.isSafeInteger(extended) || !Number.isSafeInteger(total + extended)) {
      throw new PricingError("Attempt cost is too large.");
    }
    total += extended;
  }

  if (missingNames.length > 0) {
    return { status: "missing", missingNames };
  }
  return { status: "ready", total };
}

export function statisticalUnitCost(oneAttemptCost: number, rateBp: number): number {
  const cost = assertNonNegative(oneAttemptCost, "Attempt cost");
  const rate = assertRate(rateBp);
  const numerator = cost * RATE_MAX_BP;
  if (!Number.isSafeInteger(numerator)) {
    throw new PricingError("Attempt cost is too large to price.");
  }
  return ceilDiv(numerator, rate);
}

export function saleFromMargin(unitCost: number, marginPercent: number): number {
  const cost = assertNonNegative(unitCost, "Unit cost");
  const margin = assertMarginPercent(marginPercent);
  const numerator = cost * (100 + margin);
  if (!Number.isSafeInteger(numerator)) {
    throw new PricingError("Sale price is too large.");
  }
  return ceilDiv(numerator, 100);
}

export function resolveSale(
  unitCost: number,
  marginPercent: number,
  salePriceOverride: number | null,
): ResolvedSale {
  if (salePriceOverride === null) {
    return { amount: saleFromMargin(unitCost, marginPercent), source: "margin" };
  }
  return { amount: assertCappedMoney(salePriceOverride, "Sale price"), source: "recipe" };
}

export function quoteFood(input: {
  oneAttemptCost: number;
  minimumRateBp: number;
  averageRateBp: number;
  marginPercent: number;
  salePriceOverride: number | null;
}): FoodQuote {
  const oneAttemptCost = assertNonNegative(input.oneAttemptCost, "Attempt cost");
  return {
    oneAttemptCost,
    minimum: quoteRate(
      oneAttemptCost,
      input.minimumRateBp,
      input.marginPercent,
      input.salePriceOverride,
    ),
    average: quoteRate(
      oneAttemptCost,
      input.averageRateBp,
      input.marginPercent,
      input.salePriceOverride,
    ),
  };
}

export function parseMarginPercent(value: string): number {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new PricingError(marginMessage());
  }
  return assertMarginPercent(Number(trimmed));
}

export function parseCurrencyLabel(value: string): string {
  const label = value.trim();
  if (!label) {
    throw new PricingError("Currency label is required.");
  }
  if (label.length > CURRENCY_LABEL_MAX_LENGTH) {
    throw new PricingError(
      `Currency label must be ${CURRENCY_LABEL_MAX_LENGTH} characters or fewer.`,
    );
  }
  return label;
}

export function assertPricingSettings(draft: PricingSettingsDraft): PricingSettingsDraft {
  return {
    marginPercent: assertMarginPercent(draft.marginPercent),
    currencyLabel: parseCurrencyLabel(draft.currencyLabel),
  };
}

export function pricingMessage(check: () => unknown): string | undefined {
  try {
    check();
    return undefined;
  } catch (error) {
    if (error instanceof PricingError) {
      return error.message;
    }
    throw error;
  }
}

function quoteRate(
  oneAttemptCost: number,
  rateBp: number,
  marginPercent: number,
  salePriceOverride: number | null,
): RateQuote {
  const unitCost = statisticalUnitCost(oneAttemptCost, rateBp);
  const marginSale = saleFromMargin(unitCost, marginPercent);
  const sale = resolveSale(unitCost, marginPercent, salePriceOverride);
  return {
    rateBp,
    unitCost,
    marginSale,
    sale: sale.amount,
    saleSource: sale.source,
  };
}

function assertQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxUnitValue) {
    throw new PricingError("Quantity must be a whole number of at least 1.");
  }
}

function assertCappedMoney(value: number, label: string): number {
  const amount = assertNonNegative(value, label);
  if (amount > maxUnitValue) {
    throw new PricingError(`${label} is too large.`);
  }
  return amount;
}

function assertNonNegative(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new PricingError(`${label} must be a whole number.`);
  }
  return value;
}

function assertRate(rateBp: number): number {
  if (!Number.isInteger(rateBp) || rateBp < RATE_MIN_BP || rateBp > RATE_MAX_BP) {
    throw new PricingError("Success rate must be from 0.01% to 100%.");
  }
  return rateBp;
}

function assertMarginPercent(value: number): number {
  if (!Number.isInteger(value) || value < MARGIN_PERCENT_MIN || value > MARGIN_PERCENT_MAX) {
    throw new PricingError(marginMessage());
  }
  return value;
}

function marginMessage(): string {
  return `Margin must be a whole number from ${MARGIN_PERCENT_MIN} to ${MARGIN_PERCENT_MAX}.`;
}

function ceilDiv(numerator: number, denominator: number): number {
  return Math.floor((numerator + denominator - 1) / denominator);
}
