import { expect, test } from "vitest";
import { cookingSuccessRates } from "@/domain/cooking/success";
import {
  attemptCost,
  assertPricingSettings,
  parseCurrencyLabel,
  parseMarginPercent,
  quoteFood,
  resolveSale,
  saleFromMargin,
  statisticalUnitCost,
} from "./cost";

test("a missing unit value blocks the attempt cost", () => {
  expect(
    attemptCost([
      { name: "Cooking Oil", quantity: 1, unitValue: 500 },
      { name: "Old Frying Pan", quantity: 1, unitValue: null },
      { name: "Outdoor Cooking Kit", quantity: 1, unitValue: null },
    ]),
  ).toEqual({
    status: "missing",
    missingNames: ["Old Frying Pan", "Outdoor Cooking Kit"],
  });

  expect(attemptCost([{ name: "Free Leaf", quantity: 4, unitValue: 0 }])).toEqual({
    status: "ready",
    total: 0,
  });
  expect(statisticalUnitCost(0, 4_000)).toBe(0);
});

test("a 100% kit charges one attempt, then the margin", () => {
  expect(
    attemptCost([
      { name: "Meat", quantity: 2, unitValue: 40 },
      { name: "Fantastic Cooking Kit", quantity: 1, unitValue: 20 },
    ]),
  ).toEqual({ status: "ready", total: 100 });

  const quote = quoteFood({
    oneAttemptCost: 100,
    minimumRateBp: 10_000,
    averageRateBp: 10_000,
    marginPercent: 20,
    salePriceOverride: null,
  });

  expect(quote.oneAttemptCost).toBe(100);
  expect(quote.minimum).toEqual({
    rateBp: 10_000,
    unitCost: 100,
    marginSale: 120,
    sale: 120,
    saleSource: "margin",
  });
  expect(quote.average).toEqual(quote.minimum);
  expect(saleFromMargin(1, 20)).toBe(2);
  expect(saleFromMargin(100, 0)).toBe(100);
});

test("a fractional rate ceils the statistical cost of one success", () => {
  const rates = cookingSuccessRates(
    { baseLevel: 99, dex: 99, luk: 1, mastery: 0 },
    { produceValue: 11, alwaysSuccess: false },
    1,
    3,
  );
  expect(rates).toEqual({ minBp: 3000, avgBp: 4300, maxBp: 5600 });

  expect(
    attemptCost([
      { name: "Grasshopper's Leg", quantity: 5, unitValue: 10 },
      { name: "Old Frying Pan", quantity: 1, unitValue: 20 },
      { name: "Cooking Oil", quantity: 1, unitValue: 500 },
      { name: "Outdoor Cooking Kit", quantity: 1, unitValue: 500 },
    ]),
  ).toEqual({ status: "ready", total: 1070 });

  expect(statisticalUnitCost(3, 4_000)).toBe(8);
  expect(statisticalUnitCost(10, 4_000)).toBe(25);
  expect(statisticalUnitCost(1070, rates.minBp)).toBe(3567);
  expect(statisticalUnitCost(1070, rates.avgBp)).toBe(2489);

  const quote = quoteFood({
    oneAttemptCost: 1070,
    minimumRateBp: rates.minBp,
    averageRateBp: rates.avgBp,
    marginPercent: 20,
    salePriceOverride: null,
  });
  expect(quote.minimum).toMatchObject({ unitCost: 3567, marginSale: 4281, sale: 4281 });
  expect(quote.average).toMatchObject({ unitCost: 2489, marginSale: 2987, sale: 2987 });
});

test("a recipe sale override replaces the margin sale", () => {
  expect(saleFromMargin(250, 20)).toBe(300);
  expect(resolveSale(250, 20, null)).toEqual({ amount: 300, source: "margin" });
  expect(resolveSale(250, 20, 90)).toEqual({ amount: 90, source: "recipe" });

  const quote = quoteFood({
    oneAttemptCost: 100,
    minimumRateBp: 4_000,
    averageRateBp: 10_000,
    marginPercent: 20,
    salePriceOverride: 90,
  });
  expect(quote.minimum).toMatchObject({
    unitCost: 250,
    marginSale: 300,
    sale: 90,
    saleSource: "recipe",
  });
  expect(quote.average).toMatchObject({
    unitCost: 100,
    marginSale: 120,
    sale: 90,
    saleSource: "recipe",
  });
});

test("margin and currency are whole settings values", () => {
  expect(parseMarginPercent(" 20 ")).toBe(20);
  expect(parseMarginPercent("0")).toBe(0);
  expect(() => parseMarginPercent("20.5")).toThrow(/0 to 999/);
  expect(() => parseMarginPercent("1000")).toThrow(/0 to 999/);
  expect(parseCurrencyLabel(" zeny ")).toBe("zeny");
  expect(() => parseCurrencyLabel("   ")).toThrow(/required/i);
  expect(() => parseCurrencyLabel("z".repeat(17))).toThrow(/16/);
  expect(assertPricingSettings({ marginPercent: 35, currencyLabel: " z " })).toEqual({
    marginPercent: 35,
    currencyLabel: "z",
  });
});
