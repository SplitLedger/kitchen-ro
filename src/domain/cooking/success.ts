// Cooking branch of rAthena `skill_produce_mix`, in basis points (10000 = 100%).
// A kit with alwaysSuccess, or a produce value of 15 or more, is a certain success
// and ignores the rest of the formula. Mastery is only defined for 0..1999.

export const MASTERY_MIN = 0;
export const MASTERY_MAX = 1999;
export const STAT_MIN = 0;
export const STAT_MAX = 999;
export const RATE_MIN_BP = 1;
export const RATE_MAX_BP = 10_000;

const KIT_STEP_BP = 1200;
const STAT_POINT_BP = 20;
const FOOD_LEVEL_BP = 400;
const LUK_POINT_BP = 10;
const LUK_PIVOT = 101;
const EXTRA_INGREDIENT_BP = 500;
const MASTERY_PERCENT_BP = 100;
const MASTERY_AVERAGE_BP = 50;
const PENALTY_MIN_BP = 400;
const PENALTY_AVG_BP = 250;
const PENALTY_MAX_BP = 100;

export type CookProfile = {
  baseLevel: number;
  dex: number;
  luk: number;
  mastery: number;
};

export type SuccessKit = {
  produceValue: number;
  alwaysSuccess: boolean;
};

export type SuccessRates = {
  minBp: number;
  avgBp: number;
  maxBp: number;
};

export function isCertainSuccess(kit: SuccessKit): boolean {
  return kit.alwaysSuccess || kit.produceValue >= 15;
}

export function cookingSuccessRates(
  profile: CookProfile,
  kit: SuccessKit,
  foodLevel: number,
  ingredientRowCount: number,
): SuccessRates {
  const produceValue = Math.trunc(kit.produceValue);
  if (isCertainSuccess({ produceValue, alwaysSuccess: kit.alwaysSuccess })) {
    return certainSuccess();
  }

  const mastery = masteryRoll(profile.mastery);
  const fixed =
    KIT_STEP_BP * (produceValue - 10) +
    STAT_POINT_BP * (Math.trunc(profile.baseLevel) + 1) +
    STAT_POINT_BP * (Math.trunc(profile.dex) + 1) -
    FOOD_LEVEL_BP * Math.trunc(foodLevel) -
    LUK_POINT_BP * (LUK_PIVOT - Math.trunc(profile.luk)) -
    EXTRA_INGREDIENT_BP * (Math.trunc(ingredientRowCount) - 1);

  return {
    minBp: clampRate(fixed + mastery.low * MASTERY_PERCENT_BP - PENALTY_MIN_BP),
    avgBp: clampRate(fixed + (mastery.low + mastery.high) * MASTERY_AVERAGE_BP - PENALTY_AVG_BP),
    maxBp: clampRate(fixed + mastery.high * MASTERY_PERCENT_BP - PENALTY_MAX_BP),
  };
}

export function formatSuccessRate(basisPoints: number): string {
  const whole = Math.trunc(basisPoints / 100);
  const fraction = Math.abs(basisPoints % 100);
  return `${whole}.${String(fraction).padStart(2, "0")}%`;
}

function certainSuccess(): SuccessRates {
  return { minBp: RATE_MAX_BP, avgBp: RATE_MAX_BP, maxBp: RATE_MAX_BP };
}

function masteryRoll(mastery: number): { low: number; high: number } {
  const value = clamp(Math.trunc(mastery), MASTERY_MIN, MASTERY_MAX);
  const low = 6 + div(value, 80);
  const span = 30 + 5 * div(value, 400) - low;
  if (span < 1) {
    throw new Error("Cooking mastery roll is undefined for this mastery.");
  }
  return { low, high: low + span - 1 };
}

function clampRate(basisPoints: number): number {
  return clamp(basisPoints, RATE_MIN_BP, RATE_MAX_BP);
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function div(value: number, divisor: number): number {
  return Math.trunc(value / divisor);
}
