import { expect, test } from "vitest";
import { cookingSuccessRates } from "@/domain/cooking/success";
import { planOrder, shoppingAttempts, type PlanInput, type PlanKit, type PlanRecipe } from "./plan";

const cook = { baseLevel: 99, dex: 99, luk: 1, mastery: 0 };

const outdoor: PlanKit = {
  id: 1,
  name: "Outdoor Cooking Kit",
  produceValue: 11,
  alwaysSuccess: false,
  unitValue: 100,
  inCatalog: true,
};

function recipe(
  id: number,
  name: string,
  items: PlanRecipe["items"],
  salePriceOverride: number | null = null,
): PlanRecipe {
  return {
    id,
    name,
    stat: "str",
    level: 5,
    salePriceOverride,
    items,
  };
}

const carrot = { id: 10, name: "Carrot", quantity: 1, unitValue: 10 };
const stew = recipe(1, "Stew", [
  { ...carrot, quantity: 2 },
  { id: 11, name: "Salt", quantity: 1, unitValue: 4 },
]);
const soup = recipe(2, "Soup", [carrot, { id: 12, name: "Herb", quantity: 1, unitValue: 7 }]);

function input(mode: PlanInput["mode"], soupOverride: number | null = null): PlanInput {
  return {
    mode,
    cook,
    kit: outdoor,
    marginPercent: 20,
    lines: [
      { recipe: stew, quantity: 1, saleOverride: 500 },
      { recipe: { ...soup, salePriceOverride: soupOverride }, quantity: 1, saleOverride: null },
    ],
  };
}

test("two dishes ceil attempts separately, then share an ingredient by summing", () => {
  expect(cookingSuccessRates(cook, outdoor, 5, 2)).toEqual({
    minBp: 1900,
    avgBp: 3200,
    maxBp: 4500,
  });
  expect(shoppingAttempts(1, 3200)).toBe(4);
  expect(shoppingAttempts(2, 3200)).toBe(7);
  expect(shoppingAttempts(1, 3200) + shoppingAttempts(1, 3200)).toBe(8);

  const plan = planOrder(input("expected"));
  expect(plan.lines.map((line) => [line.name, line.usedRateBp, line.attempts])).toEqual([
    ["Stew", 3200, 4],
    ["Soup", 3200, 4],
  ]);
  expect(plan.attemptsTotal).toBe(8);
  expect(
    plan.materials.map((material) => [material.name, material.quantity, material.extendedCost]),
  ).toEqual([
    ["Carrot", 12, 120],
    ["Herb", 4, 28],
    ["Salt", 4, 16],
    ["Outdoor Cooking Kit", 8, 800],
  ]);
  expect(plan.materials.find((material) => material.kind === "kit")?.quantity).toBe(
    plan.attemptsTotal,
  );
  expect(plan.statisticalFoodCost).toBe(388 + 366);
  expect(plan.gatherCost).toBe(964);
  expect(plan.roundingGap).toBe(964 - 754);
});

test("conservative planning asks for more attempts than expected", () => {
  const expected = planOrder(input("expected"));
  const conservative = planOrder(input("conservative"));

  expect(expected.lines.map((line) => line.attempts)).toEqual([4, 4]);
  expect(conservative.lines.map((line) => [line.usedRateBp, line.attempts])).toEqual([
    [1900, 6],
    [1900, 6],
  ]);
  expect(conservative.attemptsTotal).toBe(12);
  expect(conservative.materials.find((material) => material.name === "Carrot")?.quantity).toBe(18);
  expect(conservative.materials.find((material) => material.kind === "kit")?.quantity).toBe(12);
  expect(shoppingAttempts(1, 1900)).toBe(6);
});

test("a line sale override replaces only that line", () => {
  const plan = planOrder(input("expected", 300));
  const stewLine = plan.lines[0];
  const soupLine = plan.lines[1];
  expect(stewLine).toMatchObject({
    oneAttemptCost: 124,
    unitCost: 388,
    suggestedSale: 466,
    suggestedSource: "margin",
    unitSale: 500,
    saleSource: "line",
    saleOverride: 500,
  });
  expect(soupLine).toMatchObject({
    oneAttemptCost: 117,
    unitCost: 366,
    suggestedSale: 300,
    suggestedSource: "recipe",
    unitSale: 300,
    saleSource: "recipe",
    saleOverride: null,
  });
  expect(plan.saleTotal).toBe(800);
  expect(plan.profit).toBe(800 - 964);
  expect(plan.blockers).toEqual([]);
});

test("a certain-success kit orders one attempt per food in either mode", () => {
  const fantastic: PlanKit = {
    id: 5,
    name: "Fantastic Cooking Kit",
    produceValue: 15,
    alwaysSuccess: true,
    unitValue: 50,
    inCatalog: true,
  };
  const lines = [
    { recipe: stew, quantity: 3, saleOverride: null },
    { recipe: soup, quantity: 2, saleOverride: null },
  ];
  const expected = planOrder({ mode: "expected", cook, kit: fantastic, marginPercent: 20, lines });
  const conservative = planOrder({
    mode: "conservative",
    cook,
    kit: fantastic,
    marginPercent: 20,
    lines,
  });

  expect(expected.certainSuccess).toBe(true);
  expect(
    expected.lines.map((line) => [line.minRateBp, line.avgRateBp, line.maxRateBp, line.attempts]),
  ).toEqual([
    [10_000, 10_000, 10_000, 3],
    [10_000, 10_000, 10_000, 2],
  ]);
  expect(conservative.lines.map((line) => line.attempts)).toEqual([3, 2]);
  expect(expected.materials.find((material) => material.kind === "kit")).toMatchObject({
    quantity: 5,
    extendedCost: 250,
  });
  expect(expected.attemptsTotal).toBe(5);
  const stewCost = 2 * 10 * 1 + 4 + 50;
  expect(expected.lines[0]?.unitCost).toBe(stewCost);
});

test("a missing unit value keeps the attempt count and blocks confirm", () => {
  const unpriced = planOrder({
    ...input("expected"),
    lines: [
      { recipe: stew, quantity: 1, saleOverride: null },
      {
        recipe: recipe(2, "Soup", [carrot, { id: 12, name: "Herb", quantity: 1, unitValue: null }]),
        quantity: 1,
        saleOverride: null,
      },
    ],
  });

  expect(unpriced.lines.map((line) => line.attempts)).toEqual([4, 4]);
  expect(unpriced.lines[1]?.unitCost).toBeNull();
  expect(unpriced.lines[0]?.unitCost).toBe(388);
  expect(unpriced.missingNames).toEqual(["Herb"]);
  expect(unpriced.gatherCost).toBeNull();
  expect(unpriced.statisticalFoodCost).toBeNull();
  expect(unpriced.blockers).toEqual(["Add inventory for Herb."]);
});
