import { expect, test } from "vitest";
import { priceBookFromLots, summarizeLotPrices, unitPriceForBasis } from "./prices";

test("weighted average, minimum, and maximum ignore empty lots", () => {
  const summary = summarizeLotPrices([
    { quantity: 0, unitPrice: 9_000 },
    { quantity: 1, unitPrice: 1_000 },
    { quantity: 500, unitPrice: 10 },
  ]);

  expect(summary).toEqual({
    onHand: 501,
    minimum: 10,
    average: 12,
    maximum: 1_000,
  });
  expect(unitPriceForBasis(summary, "minimum")).toBe(10);
  expect(unitPriceForBasis(summary, "average")).toBe(12);
  expect(unitPriceForBasis(summary, "maximum")).toBe(1_000);
});

test("half-up rounds a 1.5 average to 2", () => {
  expect(
    summarizeLotPrices([
      { quantity: 1, unitPrice: 1 },
      { quantity: 1, unitPrice: 2 },
    ]),
  ).toMatchObject({ average: 2, minimum: 1, maximum: 2, onHand: 2 });
});

test("no remaining lots means no price", () => {
  expect(summarizeLotPrices([])).toBeNull();
  expect(summarizeLotPrices([{ quantity: 0, unitPrice: 40 }])).toBeNull();
  expect(unitPriceForBasis(null, "average")).toBeNull();
});

test("a zero unit price still counts as a price", () => {
  expect(summarizeLotPrices([{ quantity: 3, unitPrice: 0 }])).toEqual({
    onHand: 3,
    minimum: 0,
    average: 0,
    maximum: 0,
  });
});

test("price book keeps ingredient and kit lots apart", () => {
  const book = priceBookFromLots([
    { ingredientId: 4, kitId: null, quantity: 2, unitPrice: 5 },
    { ingredientId: 4, kitId: null, quantity: 2, unitPrice: 15 },
    { ingredientId: null, kitId: 1, quantity: 1, unitPrice: 100 },
    { ingredientId: 9, kitId: null, quantity: 0, unitPrice: 80 },
  ]);

  expect(book.ingredients[4]).toEqual({ onHand: 4, minimum: 5, average: 10, maximum: 15 });
  expect(book.ingredients[9]).toBeUndefined();
  expect(book.kits[1]).toMatchObject({ onHand: 1, average: 100 });
});
