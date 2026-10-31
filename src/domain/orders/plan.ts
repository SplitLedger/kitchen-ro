// An order has two different totals.
// One successful food costs ceil(one attempt * 10000 / chosen rate).
// The shopping list ceils attempts per dish, ceil(quantity * 10000 / rate),
// then multiplies that dish's recipe quantities. Dishes do not share a ceil.
// Expected uses the average rate. Conservative uses the minimum.
// A certain-success kit is 100% in both modes, so attempts equal the quantity.

import type { FoodStat } from "@/domain/catalog/food-stat";
import {
  cookingSuccessRates,
  isCertainSuccess,
  RATE_MAX_BP,
  RATE_MIN_BP,
  type CookProfile,
} from "@/domain/cooking/success";
import {
  attemptCost,
  resolveSale,
  statisticalUnitCost,
  type PricingError,
} from "@/domain/pricing/cost";

export const ORDER_QUANTITY_MAX = 9999;
const maxMoney = 999_999_999;

export const planningModes = ["expected", "conservative"] as const;
export type OrderPlanningMode = (typeof planningModes)[number];

export const planningModeLabels: Record<OrderPlanningMode, string> = {
  expected: "Expected",
  conservative: "Conservative",
};

export const saleSourceLabels = {
  margin: "Margin",
  recipe: "Recipe",
  line: "This line",
} as const;

export type OrderSaleSource = keyof typeof saleSourceLabels;

export class OrderPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderPlanError";
  }
}

export type PlanIngredient = {
  id: number;
  name: string;
  quantity: number;
  unitValue: number | null;
};

export type PlanRecipe = {
  id: number;
  name: string;
  stat: FoodStat;
  level: number;
  salePriceOverride: number | null;
  items: readonly PlanIngredient[];
};

export type PlanKit = {
  id: number;
  name: string;
  produceValue: number;
  alwaysSuccess: boolean;
  unitValue: number | null;
  inCatalog: boolean;
};

export type PlanLineInput = {
  recipe: PlanRecipe;
  quantity: number;
  saleOverride: number | null;
};

export type PlanInput = {
  mode: OrderPlanningMode;
  cook: CookProfile;
  kit: PlanKit;
  marginPercent: number;
  lines: readonly PlanLineInput[];
};

export type PlanLine = {
  recipeId: number;
  name: string;
  stat: FoodStat;
  level: number;
  ingredientRowCount: number;
  quantity: number;
  minRateBp: number;
  avgRateBp: number;
  maxRateBp: number;
  usedRateBp: number | null;
  attempts: number | null;
  oneAttemptCost: number | null;
  missingNames: readonly string[];
  unitCost: number | null;
  suggestedSale: number | null;
  suggestedSource: "margin" | "recipe" | null;
  unitSale: number | null;
  saleSource: OrderSaleSource | null;
  saleOverride: number | null;
};

export type PlanMaterial = {
  kind: "ingredient" | "kit";
  ingredientId: number | null;
  kitId: number | null;
  name: string;
  quantity: number;
  unitValue: number | null;
  extendedCost: number | null;
  onHand?: number;
  shortfall?: number;
  priceMinimum?: number | null;
  priceMaximum?: number | null;
};

export type OrderPlan = {
  lines: PlanLine[];
  materials: PlanMaterial[];
  attemptsTotal: number;
  statisticalFoodCost: number | null;
  gatherCost: number | null;
  saleTotal: number | null;
  profit: number | null;
  roundingGap: number | null;
  missingNames: readonly string[];
  blockers: readonly string[];
  certainSuccess: boolean;
};

export function isOrderPlanningMode(value: string): value is OrderPlanningMode {
  return (planningModes as readonly string[]).includes(value);
}

export function shoppingAttempts(quantity: number, rateBp: number): number {
  const foods = assertOrderQuantity(quantity);
  const rate = assertRate(rateBp);
  const numerator = foods * RATE_MAX_BP;
  if (!Number.isSafeInteger(numerator)) {
    throw new OrderPlanError("Quantity is too large to plan.");
  }
  return ceilDiv(numerator, rate);
}

export function assertOrderQuantity(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > ORDER_QUANTITY_MAX) {
    throw new OrderPlanError(quantityMessage());
  }
  return value;
}

export function parseOrderQuantity(value: string): number {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new OrderPlanError(quantityMessage());
  }
  return assertOrderQuantity(Number(trimmed));
}

export function parseSaleOverride(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^\d+$/.test(trimmed)) {
    throw new OrderPlanError("Sale price must be a whole number.");
  }
  return assertSaleAmount(Number(trimmed));
}

export function orderPlanMessage(check: () => unknown): string | undefined {
  try {
    check();
    return undefined;
  } catch (error) {
    if (error instanceof OrderPlanError) {
      return error.message;
    }
    throw error;
  }
}

export function planOrder(input: PlanInput): OrderPlan {
  try {
    return planOrderUnsafe(input);
  } catch (error) {
    if (error instanceof OrderPlanError || isPricingError(error)) {
      return summarize([], [], isCertainSuccess(input.kit), [error.message]);
    }
    throw error;
  }
}

export function summarize(
  lines: readonly PlanLine[],
  materials: readonly PlanMaterial[],
  certainSuccess: boolean,
  blockers: readonly string[],
): OrderPlan {
  const missingNames = missingPriceNames(lines, materials);
  const priceBlockers =
    missingNames.length > 0 ? [`Add inventory for ${missingNames.join(", ")}.`] : [];
  const attemptsTotal = lines.reduce((sum, line) => sum + (line.attempts ?? 0), 0);
  const attemptsReady = lines.every((line) => line.attempts !== null);
  const statisticalFoodCost = sumMoney(
    lines,
    (line) => line.unitCost,
    (line) => line.unitCost! * line.quantity,
  );
  const gatherCost = !attemptsReady
    ? null
    : sumMoney(
        materials,
        (material) => material.extendedCost,
        (material) => material.extendedCost!,
      );
  const saleTotal = sumMoney(
    lines,
    (line) => line.unitSale,
    (line) => line.unitSale! * line.quantity,
  );

  return {
    lines: [...lines],
    materials: [...materials],
    attemptsTotal,
    statisticalFoodCost,
    gatherCost,
    saleTotal,
    profit: saleTotal !== null && gatherCost !== null ? subtractMoney(saleTotal, gatherCost) : null,
    roundingGap:
      gatherCost !== null && statisticalFoodCost !== null
        ? subtractMoney(gatherCost, statisticalFoodCost)
        : null,
    missingNames,
    blockers: [...blockers, ...priceBlockers],
    certainSuccess,
  };
}

function planOrderUnsafe(input: PlanInput): OrderPlan {
  const blockers: string[] = [];
  const marginOk = isMargin(input.marginPercent);
  if (!marginOk) {
    blockers.push("Margin must be a whole number from 0 to 999.");
  }
  if (!input.kit.inCatalog) {
    blockers.push("Choose a cooking kit. The kit on this order is no longer in the catalog.");
  }
  if (input.lines.length === 0) {
    blockers.push("Add at least one dish before confirming.");
  }

  const lines: PlanLine[] = [];
  const ingredients = new Map<number, PlanMaterial>();

  for (const line of input.lines) {
    const planned = planLine(input, line, blockers, marginOk);
    lines.push(planned);
    if (planned.attempts === null) {
      continue;
    }
    for (const item of line.recipe.items) {
      addIngredient(ingredients, item, planned.attempts);
    }
  }

  const materials = [...ingredients.values()].sort(
    (left, right) =>
      left.name.localeCompare(right.name, "en") ||
      (left.ingredientId ?? 0) - (right.ingredientId ?? 0),
  );
  const attemptsTotal = lines.reduce((sum, line) => sum + (line.attempts ?? 0), 0);
  if (attemptsTotal > 0) {
    const unitValue = input.kit.inCatalog ? input.kit.unitValue : null;
    materials.push({
      kind: "kit",
      ingredientId: null,
      kitId: input.kit.inCatalog ? input.kit.id : null,
      name: input.kit.name,
      quantity: attemptsTotal,
      unitValue,
      extendedCost: extend(attemptsTotal, unitValue),
    });
  }

  return summarize(lines, materials, isCertainSuccess(input.kit), blockers);
}

function planLine(
  input: PlanInput,
  line: PlanLineInput,
  blockers: string[],
  marginOk: boolean,
): PlanLine {
  const recipe = line.recipe;
  const rates = cookingSuccessRates(input.cook, input.kit, recipe.level, recipe.items.length);
  const usedRateBp = chosenRate(input.mode, rates);
  const usableRate = isRate(usedRateBp) ? usedRateBp : null;
  if (usableRate === null) {
    blockers.push(`The success rate for ${recipe.name} cannot be used.`);
  }

  let quantity = line.quantity;
  let attempts: number | null = null;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > ORDER_QUANTITY_MAX) {
    blockers.push(
      `Quantity for ${recipe.name} must be a whole number from 1 to ${ORDER_QUANTITY_MAX}.`,
    );
    quantity = 0;
  } else if (usableRate !== null) {
    attempts = shoppingAttempts(quantity, usableRate);
  }

  const saleOverride = validSaleOverride(line.saleOverride, recipe.name, blockers);
  const attempt = lineAttempt(recipe, input.kit);
  let oneAttemptCost: number | null = null;
  let missingNames: readonly string[] = [];
  let unitCost: number | null = null;
  let suggestedSale: number | null = null;
  let suggestedSource: "margin" | "recipe" | null = null;
  let unitSale: number | null = null;
  let saleSource: OrderSaleSource | null = null;

  if (attempt.status === "ready" && usableRate !== null && marginOk) {
    oneAttemptCost = attempt.total;
    unitCost = statisticalUnitCost(attempt.total, usableRate);
    const suggested = resolveSale(unitCost, input.marginPercent, recipe.salePriceOverride);
    suggestedSale = suggested.amount;
    suggestedSource = suggested.source;
    unitSale = suggested.amount;
    saleSource = suggested.source;
  } else if (attempt.status === "missing") {
    missingNames = attempt.missingNames;
  }

  if (saleOverride !== null) {
    unitSale = saleOverride;
    saleSource = "line";
  }

  return {
    recipeId: recipe.id,
    name: recipe.name,
    stat: recipe.stat,
    level: recipe.level,
    ingredientRowCount: recipe.items.length,
    quantity,
    minRateBp: rates.minBp,
    avgRateBp: rates.avgBp,
    maxRateBp: rates.maxBp,
    usedRateBp: usableRate,
    attempts,
    oneAttemptCost,
    missingNames,
    unitCost,
    suggestedSale,
    suggestedSource,
    unitSale,
    saleSource,
    saleOverride,
  };
}

function lineAttempt(recipe: PlanRecipe, kit: PlanKit) {
  const ingredients = recipe.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unitValue: item.unitValue,
  }));
  if (!kit.inCatalog) {
    const priced = attemptCost(ingredients);
    if (priced.status === "missing") {
      return priced;
    }
    return { status: "missing" as const, missingNames: [] as string[] };
  }
  return attemptCost([...ingredients, { name: kit.name, quantity: 1, unitValue: kit.unitValue }]);
}

function chosenRate(mode: OrderPlanningMode, rates: { minBp: number; avgBp: number }): number {
  return mode === "conservative" ? rates.minBp : rates.avgBp;
}

function addIngredient(
  materials: Map<number, PlanMaterial>,
  item: PlanIngredient,
  attempts: number,
): void {
  const added = item.quantity * attempts;
  if (!Number.isSafeInteger(added)) {
    throw new OrderPlanError("Shopping quantity is too large.");
  }
  const existing = materials.get(item.id);
  if (!existing) {
    materials.set(item.id, {
      kind: "ingredient",
      ingredientId: item.id,
      kitId: null,
      name: item.name,
      quantity: added,
      unitValue: item.unitValue,
      extendedCost: extend(added, item.unitValue),
    });
    return;
  }
  const quantity = existing.quantity + added;
  if (!Number.isSafeInteger(quantity)) {
    throw new OrderPlanError("Shopping quantity is too large.");
  }
  existing.quantity = quantity;
  existing.extendedCost = extend(quantity, existing.unitValue);
}

function missingPriceNames(
  lines: readonly PlanLine[],
  materials: readonly PlanMaterial[],
): string[] {
  const names: string[] = [];
  for (const material of materials) {
    if (material.unitValue === null && !names.includes(material.name)) {
      names.push(material.name);
    }
  }
  for (const line of lines) {
    for (const name of line.missingNames) {
      if (!names.includes(name)) {
        names.push(name);
      }
    }
  }
  return names;
}

function sumMoney<T>(
  rows: readonly T[],
  value: (row: T) => number | null,
  amount: (row: T) => number,
): number | null {
  if (rows.length === 0) {
    return 0;
  }
  if (rows.some((row) => value(row) === null)) {
    return null;
  }
  return rows.reduce((sum, row) => addMoney(sum, amount(row)), 0);
}

function validSaleOverride(value: number | null, name: string, blockers: string[]): number | null {
  if (value === null) {
    return null;
  }
  if (!Number.isSafeInteger(value) || value < 0 || value > maxMoney) {
    blockers.push(`Sale price for ${name} must be a whole number.`);
    return null;
  }
  return value;
}

function extend(quantity: number, unitValue: number | null): number | null {
  if (unitValue === null) {
    return null;
  }
  const total = quantity * unitValue;
  if (!Number.isSafeInteger(total)) {
    throw new OrderPlanError("Gather cost is too large.");
  }
  return total;
}

function addMoney(left: number, right: number): number {
  const total = left + right;
  if (!Number.isSafeInteger(total)) {
    throw new OrderPlanError("This order is too large to price.");
  }
  return total;
}

function subtractMoney(left: number, right: number): number {
  const total = left - right;
  if (!Number.isSafeInteger(total)) {
    throw new OrderPlanError("This order is too large to price.");
  }
  return total;
}

function assertSaleAmount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > maxMoney) {
    throw new OrderPlanError("Sale price is too large.");
  }
  return value;
}

function assertRate(rateBp: number): number {
  if (!isRate(rateBp)) {
    throw new OrderPlanError("Success rate must be from 0.01% to 100%.");
  }
  return rateBp;
}

function isRate(rateBp: number): boolean {
  return Number.isInteger(rateBp) && rateBp >= RATE_MIN_BP && rateBp <= RATE_MAX_BP;
}

function isMargin(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 999;
}

function isPricingError(error: unknown): error is PricingError {
  return error instanceof Error && error.name === "PricingError";
}

function quantityMessage(): string {
  return `Quantity must be a whole number from 1 to ${ORDER_QUANTITY_MAX}.`;
}

function ceilDiv(numerator: number, denominator: number): number {
  return Math.floor((numerator + denominator - 1) / denominator);
}
