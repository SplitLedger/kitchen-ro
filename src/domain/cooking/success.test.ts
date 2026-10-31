import { expect, test } from "vitest";
import { officialKits, officialRecipes } from "@/domain/catalog/official-catalog";
import {
  cookingSuccessRates,
  formatSuccessRate,
  type CookProfile,
  type SuccessKit,
} from "./success";

const fixture: CookProfile = { baseLevel: 99, dex: 90, luk: 50, mastery: 0 };
const outdoor = kit("outdoor");
const royal = kit("royal");

function kit(seedKey: string): SuccessKit {
  const row = officialKits.find((candidate) => candidate.seedKey === seedKey);
  if (!row) {
    throw new Error(`Missing kit ${seedKey}`);
  }
  return { produceValue: row.produceValue, alwaysSuccess: row.alwaysSuccess };
}

function dish(name: string): { level: number; rows: number } {
  const recipe = officialRecipes.find((candidate) => candidate.name === name);
  if (!recipe) {
    throw new Error(`Missing dish ${name}`);
  }
  return { level: recipe.level, rows: recipe.items.length };
}

test("Fried Grasshopper Legs matches the published outdoor fixture", () => {
  const legs = dish("Fried Grasshopper Legs");
  expect(legs).toEqual({ level: 1, rows: 3 });

  const rates = cookingSuccessRates(fixture, outdoor, legs.level, legs.rows);
  expect(rates).toEqual({ minBp: 3310, avgBp: 4610, maxBp: 5910 });
  expect(formatSuccessRate(rates.minBp)).toBe("33.10%");
  expect(formatSuccessRate(rates.avgBp)).toBe("46.10%");
  expect(formatSuccessRate(rates.maxBp)).toBe("59.10%");
});

test("Mastela Fruit Wine outdoor average is 20.10%", () => {
  const wine = dish("Mastela Fruit Wine");
  expect(wine).toEqual({ level: 5, rows: 5 });

  const rates = cookingSuccessRates(fixture, outdoor, wine.level, wine.rows);
  expect(rates).toEqual({ minBp: 710, avgBp: 2010, maxBp: 3310 });
  expect(formatSuccessRate(rates.avgBp)).toBe("20.10%");
});

test("Steamed Tongue clamps to the floor outdoors and is about 21% with a Royal kit", () => {
  const tongue = dish("Steamed Tongue");
  expect(tongue).toEqual({ level: 10, rows: 8 });

  expect(cookingSuccessRates(fixture, outdoor, tongue.level, tongue.rows)).toEqual({
    minBp: 1,
    avgBp: 1,
    maxBp: 1,
  });
  const royalRates = cookingSuccessRates(fixture, royal, tongue.level, tongue.rows);
  expect(royalRates).toEqual({ minBp: 810, avgBp: 2110, maxBp: 3410 });
  expect(formatSuccessRate(royalRates.avgBp)).toBe("21.10%");
  expect(formatSuccessRate(1)).toBe("0.01%");
});

test("each produce step adds 12 percentage points", () => {
  const legs = dish("Fried Grasshopper Legs");
  const previous = { produceValue: 10, alwaysSuccess: false };
  for (const produceValue of [11, 12, 13, 14]) {
    const current = { produceValue, alwaysSuccess: false };
    const before = cookingSuccessRates(fixture, previous, legs.level, legs.rows);
    const after = cookingSuccessRates(fixture, current, legs.level, legs.rows);
    expect(after.minBp - before.minBp).toBe(1200);
    expect(after.avgBp - before.avgBp).toBe(1200);
    expect(after.maxBp - before.maxBp).toBe(1200);
    previous.produceValue = produceValue;
  }
});

test("LUK under 101 penalizes and LUK over 101 bonuses by 0.10% per point", () => {
  const at = (luk: number) => cookingSuccessRates({ ...fixture, luk }, outdoor, 1, 3);
  expect(at(101).avgBp - at(50).avgBp).toBe(510);
  expect(at(102).avgBp - at(101).avgBp).toBe(10);
  expect(at(0).minBp - at(1).minBp).toBe(-10);
});

test("each ingredient row after the first costs 5 percentage points", () => {
  const one = cookingSuccessRates(fixture, outdoor, 1, 1);
  const three = cookingSuccessRates(fixture, outdoor, 1, 3);
  expect(one.minBp - three.minBp).toBe(1000);
  expect(one.avgBp - three.avgBp).toBe(1000);
  expect(one.maxBp - three.maxBp).toBe(1000);
});

test("each food level costs 4 percentage points", () => {
  const level1 = cookingSuccessRates(fixture, outdoor, 1, 3);
  const level2 = cookingSuccessRates(fixture, outdoor, 2, 3);
  expect(level1.avgBp - level2.avgBp).toBe(400);
});

test("mastery 0 rolls 6 through 29 and later masteries move the ends independently", () => {
  const at = (mastery: number) => cookingSuccessRates({ ...fixture, mastery }, outdoor, 1, 3);
  const start = at(0);
  const at80 = at(80);
  expect(at80.minBp - start.minBp).toBe(100);
  expect(at80.avgBp - start.avgBp).toBe(50);
  expect(at80.maxBp - start.maxBp).toBe(0);

  const at400 = at(400);
  expect(at400.minBp - start.minBp).toBe(500);
  expect(at400.avgBp - start.avgBp).toBe(500);
  expect(at400.maxBp - start.maxBp).toBe(500);

  expect(at(1999)).toEqual({ minBp: 5710, avgBp: 6810, maxBp: 7910 });
});

test("mastery outside 0..1999 uses the nearest defined value", () => {
  const at = (mastery: number) => cookingSuccessRates({ ...fixture, mastery }, outdoor, 1, 3);
  expect(at(-10)).toEqual(at(0));
  expect(at(5000)).toEqual(at(1999));
});

test("Fantastic and any produce value of 15 or more is 100% on all three rates", () => {
  const terrible: CookProfile = { baseLevel: 0, dex: 0, luk: 0, mastery: 0 };
  const tongue = dish("Steamed Tongue");
  expect(
    cookingSuccessRates(
      terrible,
      { produceValue: 11, alwaysSuccess: true },
      tongue.level,
      tongue.rows,
    ),
  ).toEqual({ minBp: 10000, avgBp: 10000, maxBp: 10000 });
  expect(
    cookingSuccessRates(
      terrible,
      { produceValue: 15, alwaysSuccess: false },
      tongue.level,
      tongue.rows,
    ),
  ).toEqual({ minBp: 10000, avgBp: 10000, maxBp: 10000 });
  expect(formatSuccessRate(10000)).toBe("100.00%");
});

test("the ceiling clamps one rate without moving the others", () => {
  const rates = cookingSuccessRates(
    { ...fixture, luk: 100 },
    { produceValue: 14, alwaysSuccess: false },
    1,
    3,
  );
  expect(rates).toEqual({ minBp: 7410, avgBp: 8710, maxBp: 10000 });
});

test("min, average, and max stay ordered for every defined mastery", () => {
  const profile = { baseLevel: 1, dex: 1, luk: 1 };
  for (let mastery = 0; mastery <= 1999; mastery += 1) {
    const rates = cookingSuccessRates({ ...profile, mastery }, outdoor, 1, 1);
    expect(rates.minBp, `mastery ${mastery} min`).toBeLessThanOrEqual(rates.avgBp);
    expect(rates.avgBp, `mastery ${mastery} avg`).toBeLessThanOrEqual(rates.maxBp);
    expect(rates.minBp, `mastery ${mastery} floor`).toBeGreaterThanOrEqual(1);
    expect(rates.maxBp, `mastery ${mastery} ceiling`).toBeLessThanOrEqual(10000);
  }
});
