import { expect, test } from "vitest";
import { foodStats } from "./food-stat";
import {
  officialIngredients,
  officialKits,
  officialRecipes,
  seedKeyFromName,
} from "./official-catalog";

test("includes 60 recipes and every stat from level 1 through 10", () => {
  expect(officialRecipes).toHaveLength(60);
  for (const stat of foodStats) {
    const levels = officialRecipes
      .filter((recipe) => recipe.stat === stat)
      .map((recipe) => recipe.level)
      .sort((left, right) => left - right);
    expect(levels).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  }
});

test("every recipe has at least one ingredient and every line points at a known ingredient", () => {
  const ingredientsByKey = new Map(officialIngredients.map((row) => [row.seedKey, row]));
  expect(new Set(officialIngredients.map((row) => row.seedKey)).size).toBe(
    officialIngredients.length,
  );
  expect(new Set(officialIngredients.map((row) => row.name)).size).toBe(officialIngredients.length);
  expect(new Set(officialRecipes.map((row) => row.seedKey)).size).toBe(officialRecipes.length);

  for (const recipe of officialRecipes) {
    expect(recipe.items.length).toBeGreaterThan(0);
    expect(recipe.cookbookLabel).toBe(`Level ${recipe.level} Cookbook`);
    expect(recipe.statBonus).toBe(recipe.level);
    const names = recipe.items.map((item) => item.ingredientName);
    expect(new Set(names).size).toBe(names.length);
    for (const item of recipe.items) {
      expect(item.quantity).toBeGreaterThan(0);
      expect(Number.isInteger(item.quantity)).toBe(true);
      const ingredient = ingredientsByKey.get(item.ingredientSeedKey);
      expect(ingredient?.name).toBe(item.ingredientName);
      expect(ingredient?.seedKey).toBe(seedKeyFromName(item.ingredientName));
    }
  }

  for (const ingredient of officialIngredients) {
    const used = officialRecipes.some((recipe) =>
      recipe.items.some((item) => item.ingredientSeedKey === ingredient.seedKey),
    );
    expect(used).toBe(true);
  }
});

test("kit produce values run from 11 through 15 and only Fantastic always succeeds", () => {
  expect(officialKits.map((kit) => kit.produceValue)).toEqual([11, 12, 13, 14, 15]);
  const always = officialKits.filter((kit) => kit.alwaysSuccess);
  expect(always.map((kit) => kit.seedKey)).toEqual(["fantastic"]);
  expect(officialKits.find((kit) => kit.seedKey === "outdoor")).toMatchObject({
    name: "Outdoor Cooking Kit",
    referencePrice: 380,
    alwaysSuccess: false,
  });
  expect(officialKits.find((kit) => kit.seedKey === "home")).toMatchObject({
    name: "Home Cooking Kit",
    referencePrice: 760,
    alwaysSuccess: false,
  });
  for (const kit of officialKits) {
    if (kit.seedKey === "outdoor" || kit.seedKey === "home") {
      continue;
    }
    expect(kit.referencePrice).toBeNull();
  }
});

test("normalizes wiki typos and keeps the published ingredient lines", () => {
  const names = [
    ...officialIngredients.map((row) => row.name),
    ...officialRecipes.map((row) => row.name),
  ];
  expect(names.some((name) => name.includes("Hinale") && !name.includes("Hinalle"))).toBe(false);
  expect(names).not.toContain("Aloevera");
  expect(names.join("\n")).not.toContain("Jack 'o");

  expect(lines("Fried Grasshopper Legs")).toEqual([
    ["Grasshopper's Leg", 5],
    ["Old Frying Pan", 1],
    ["Cooking Oil", 1],
  ]);
  expect(lines("Green Salad")).toEqual([
    ["Hinalle Leaflet", 2],
    ["Aloe Leaflet", 3],
    ["Sharp Leaf", 10],
    ["Huge Leaf", 6],
    ["Sweet Sauce", 1],
    ["Yellow Spice", 1],
  ]);
  expect(lines("Mastela Fruit Wine")).toHaveLength(5);
  expect(lines("Steamed Tongue")).toEqual([
    ["Tongue", 20],
    ["Alcohol", 1],
    ["Aloe Vera", 2],
    ["Royal Jelly", 5],
    ["Blue Potion", 2],
    ["Pot", 1],
    ["Spicy Sauce", 1],
    ["Yggdrasil Leaf", 10],
  ]);
  expect(lines("Steamed Bat Wing in Pumpkin").map(([name]) => name)).toContain("Jack o' Pumpkin");
  expect(lines("Incredibly Spicy Curry")[0]).toEqual(["Aloe Vera", 1]);
  expect(lines("Lucky Soup").at(-1)).toEqual(["Aloe", 1]);
});

test("stores NPC shop prices after Discount level 10 and leaves the rest empty", () => {
  expect(price("Cooking Oil")).toBe(380);
  expect(price("Meat")).toBe(38);
  expect(price("Mastela Fruit")).toBe(6460);
  expect(price("Apple")).toBe(11);
  expect(price("Jack o' Pumpkin")).toBe(284);
  expect(price("Memento")).toBe(456);
  expect(price("Shrimp")).toBe(418);
  expect(price("Red Chile")).toBe(50);
  expect(price("Grasshopper's Leg")).toBeNull();
  expect(price("Hinalle Leaflet")).toBeNull();
  expect(price("Aloe Vera")).toBeNull();
  expect(price("Aloe")).toBeNull();
});

function lines(name: string): Array<[string, number]> {
  const recipe = officialRecipes.find((row) => row.name === name);
  if (!recipe) {
    throw new Error(`Missing recipe ${name}.`);
  }
  return recipe.items.map((item) => [item.ingredientName, item.quantity]);
}

function price(name: string): number | null {
  const ingredient = officialIngredients.find((row) => row.name === name);
  if (!ingredient) {
    throw new Error(`Missing ingredient ${name}.`);
  }
  return ingredient.referencePrice;
}
