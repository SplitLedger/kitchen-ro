import { type FoodStat } from "./food-stat";

// Transcribed from https://irowiki.org/wiki/Cooking.
// A leading number on that page is the quantity. A bare item is quantity 1.
// Hinale Leaflet is stored as Hinalle Leaflet, Aloevera as Aloe Vera,
// and Jack 'o Pumpkin as Jack o' Pumpkin.
// referencePrice is an NPC shop price printed on that page. Unlisted items stay null.

export type OfficialIngredient = {
  seedKey: string;
  name: string;
  referencePrice: number | null;
};

export type OfficialKit = {
  seedKey: string;
  name: string;
  produceValue: number;
  alwaysSuccess: boolean;
  referencePrice: number | null;
};

export type OfficialRecipeItem = {
  ingredientName: string;
  ingredientSeedKey: string;
  quantity: number;
};

export type OfficialRecipe = {
  seedKey: string;
  name: string;
  stat: FoodStat;
  level: number;
  weight: number;
  hpRegen: number;
  spRegen: number;
  statBonus: number;
  cookbookLabel: string;
  items: readonly OfficialRecipeItem[];
};

type RecipeSource = {
  stat: FoodStat;
  level: number;
  name: string;
  weight: number;
  hpRegen: number;
  spRegen: number;
  statBonus: number;
  lines: ReadonlyArray<readonly [string, number]>;
};

const npcReferencePrices: Readonly<Record<string, number>> = {
  Apple: 15,
  Banana: 15,
  "Bag of Grain": 200,
  Bread: 150,
  China: 1000,
  "Cooking Oil": 500,
  "Edible Mushroom": 40,
  "Fresh Fish": 250,
  "Jack o' Pumpkin": 374,
  "Mastela Fruit": 8500,
  Meat: 50,
  Memento: 600,
  Milk: 25,
  Pot: 200,
  "Red Chile": 66,
  "Red Spice": 1000,
  "Savory Sauce": 700,
  Shrimp: 550,
  "Spicy Sauce": 700,
  "Sweet Sauce": 700,
  "Yellow Spice": 1000,
};

export const officialKits: readonly OfficialKit[] = [
  {
    seedKey: "outdoor",
    name: "Outdoor Cooking Kit",
    produceValue: 11,
    alwaysSuccess: false,
    referencePrice: 500,
  },
  {
    seedKey: "home",
    name: "Home Cooking Kit",
    produceValue: 12,
    alwaysSuccess: false,
    referencePrice: 1000,
  },
  {
    seedKey: "professional",
    name: "Professional Cooking Kit",
    produceValue: 13,
    alwaysSuccess: false,
    referencePrice: null,
  },
  {
    seedKey: "royal",
    name: "Royal Cooking Kit",
    produceValue: 14,
    alwaysSuccess: false,
    referencePrice: null,
  },
  {
    seedKey: "fantastic",
    name: "Fantastic Cooking Kit",
    produceValue: 15,
    alwaysSuccess: true,
    referencePrice: null,
  },
];

const recipeSources: readonly RecipeSource[] = [
  dish("str", 1, "Fried Grasshopper Legs", 6, 5, 0, 1, [
    ["Grasshopper's Leg", 5],
    ["Old Frying Pan", 1],
    ["Cooking Oil", 1],
  ]),
  dish("str", 2, "Seasoned Sticky Webfoot", 50, 5, 0, 2, [
    ["Sticky Webfoot", 20],
    ["Green Herb", 10],
    ["Yellow Herb", 10],
    ["Savory Sauce", 1],
  ]),
  dish("str", 3, "Bomber Steak", 50, 5, 0, 3, [
    ["Old Frying Pan", 1],
    ["Green Herb", 10],
    ["Red Chile", 5],
    ["Meat", 4],
    ["Spicy Sauce", 1],
  ]),
  dish("str", 4, "Herb Marinade Beef", 50, 5, 0, 4, [
    ["Red Herb", 3],
    ["Yellow Herb", 2],
    ["Green Herb", 3],
    ["Lemon", 1],
    ["Meat", 5],
    ["Sweet Sauce", 1],
  ]),
  dish("str", 5, "Lutie Lady's Pancake", 50, 10, 0, 5, [
    ["Honey", 2],
    ["Potato", 10],
    ["Cooking Oil", 1],
    ["Carrot", 3],
    ["Bag of Grain", 1],
  ]),
  dish("str", 6, "Shiny Marinade Beef", 80, 10, 2, 6, [
    ["Honey", 2],
    ["Yellow Herb", 1],
    ["Shining Scale", 20],
    ["Meat", 10],
    ["Mastela Fruit", 1],
  ]),
  dish("str", 7, "Whole Roast", 100, 10, 4, 7, [
    ["Live Coal", 1],
    ["Coal", 2],
    ["Trunk", 15],
    ["White Herb", 10],
    ["Meat", 10],
    ["Spicy Sauce", 1],
  ]),
  dish("str", 8, "Bearfoot Special", 50, 15, 6, 8, [
    ["Bear's Footskin", 20],
    ["Aloe Leaflet", 2],
    ["Hinalle Leaflet", 1],
    ["Carrot", 10],
    ["Jack o' Pumpkin", 10],
    ["Savory Sauce", 1],
  ]),
  dish("str", 9, "Tendon Satay", 100, 15, 8, 9, [
    ["Tendon", 40],
    ["Cheese", 10],
    ["Coal", 2],
    ["Green Herb", 30],
    ["Squid Ink", 10],
    ["Pot", 1],
    ["Spicy Sauce", 1],
  ]),
  dish("str", 10, "Steamed Tongue", 100, 20, 10, 10, [
    ["Tongue", 20],
    ["Alcohol", 1],
    ["Aloe Vera", 2],
    ["Royal Jelly", 5],
    ["Blue Potion", 2],
    ["Pot", 1],
    ["Spicy Sauce", 1],
    ["Yggdrasil Leaf", 10],
  ]),
  dish("vit", 1, "Steamed Crab Nippers", 10, 5, 0, 1, [
    ["Nipper", 10],
    ["Green Herb", 10],
    ["Yellow Potion", 1],
  ]),
  dish("vit", 2, "Assorted Seafood", 20, 5, 0, 2, [
    ["Clam Flesh", 10],
    ["Fin", 5],
    ["Gill", 5],
    ["Fresh Fish", 1],
  ]),
  dish("vit", 3, "Clam Soup", 30, 5, 0, 3, [
    ["Clam Flesh", 20],
    ["Conch", 10],
    ["Honey", 1],
    ["Sweet Sauce", 1],
  ]),
  dish("vit", 4, "Seasoned Jellyfish", 50, 5, 0, 4, [
    ["Tentacle", 30],
    ["White Herb", 10],
    ["Soft Blade of Grass", 10],
    ["Old Frying Pan", 1],
    ["Squid Ink", 20],
  ]),
  dish("vit", 5, "Spicy Fried Bao", 80, 10, 0, 5, [
    ["Bao", 20],
    ["Yellow Herb", 10],
    ["Green Herb", 20],
    ["Spicy Sauce", 1],
    ["Red Spice", 1],
  ]),
  dish("vit", 6, "Awfully Bitter Bracer", 50, 13, 0, 6, [
    ["Brown Root", 20],
    ["Maneater Root", 10],
    ["Mushroom Spore", 20],
    ["Honey", 2],
    ["Edible Mushroom", 1],
  ]),
  dish("vit", 7, "Sumptuous Feast", 40, 16, 0, 7, [
    ["Fish Tail", 10],
    ["Aloe Leaflet", 5],
    ["Mane", 10],
    ["Fresh Fish", 2],
    ["Pet Food", 10],
    ["Sweet Sauce", 1],
  ]),
  dish("vit", 8, "Giant Burrito", 100, 19, 0, 8, [
    ["Fig Leaf", 20],
    ["Rainbow Carrot", 5],
    ["Meat", 20],
    ["Jack o' Pumpkin", 10],
    ["Savory Sauce", 1],
    ["Bag of Grain", 2],
  ]),
  dish("vit", 9, "Ascending Dragon Soup", 100, 22, 0, 9, [
    ["Dragon Skin", 10],
    ["Dragon Tail", 20],
    ["Royal Jelly", 6],
    ["Fatty Chubby Earthworm", 1],
    ["Spicy Sauce", 1],
    ["Yggdrasil Leaf", 3],
    ["Red Spice", 1],
  ]),
  dish("vit", 10, "Immortal Stew", 100, 25, 0, 10, [
    ["Immortal Heart", 10],
    ["Yggdrasil Seed", 1],
    ["Anodyne", 2],
    ["Mermaid's Heart", 10],
    ["Amulet", 10],
    ["Bitter Herb", 2],
    ["Memento", 10],
    ["Spicy Sauce", 2],
  ]),
  dish("int", 1, "Grape Juice Herbal Tea", 10, 0, 5, 1, [
    ["Grape", 3],
    ["Red Potion", 2],
  ]),
  dish("int", 2, "Autumn Red Tea", 50, 0, 5, 2, [
    ["Blue Herb", 5],
    ["Red Herb", 10],
    ["Yellow Herb", 10],
  ]),
  dish("int", 3, "Honey Herbal Tea", 50, 0, 5, 3, [
    ["Honey", 2],
    ["White Herb", 10],
    ["Yellow Spice", 1],
  ]),
  dish("int", 4, "Morroc Fruit Wine", 30, 0, 5, 4, [
    ["Strawberry", 10],
    ["Lemon", 4],
    ["Orange", 10],
    ["Alcohol", 2],
    ["Grape", 5],
  ]),
  dish("int", 5, "Mastela Fruit Wine", 40, 0, 10, 5, [
    ["Blue Potion", 1],
    ["Alcohol", 2],
    ["Lemon", 2],
    ["Mastela Fruit", 4],
    ["Yellow Spice", 1],
  ]),
  dish("int", 6, "Red Mushroom Wine", 30, 2, 10, 6, [
    ["Grape Juice", 3],
    ["Mushroom Spore", 20],
    ["Alcohol", 1],
    ["Edible Mushroom", 3],
    ["Red Spice", 1],
  ]),
  dish("int", 7, "Special Royal Jelly Herbal Tea", 80, 4, 10, 7, [
    ["Royal Jelly", 4],
    ["Honey", 2],
    ["White Herb", 5],
    ["Hinalle Leaflet", 10],
    ["Yellow Spice", 1],
  ]),
  dish("int", 8, "Royal Family Tea", 100, 6, 10, 8, [
    ["Prickly Fruit", 4],
    ["Hinalle Leaflet", 10],
    ["Aloe Leaflet", 10],
    ["Royal Jelly", 6],
    ["Yggdrasil Leaf", 3],
    ["Yellow Spice", 1],
  ]),
  dish("int", 9, "Tristam 12", 100, 8, 15, 9, [
    ["Orange", 10],
    ["Alcohol", 5],
    ["Royal Jelly", 4],
    ["Blue Potion", 2],
    ["Aloe Leaflet", 10],
    ["Yggdrasil Leaf", 10],
    ["Yellow Spice", 1],
  ]),
  dish("int", 10, "Dragon Breath Cocktail", 100, 10, 20, 10, [
    ["Maneater Root", 10],
    ["Blue Herb", 10],
    ["Singing Plant", 1],
    ["Aloe Leaflet", 5],
    ["Royal Jelly", 5],
    ["Lemon", 5],
    ["Prickly Fruit", 5],
    ["Yggdrasil Berry", 1],
  ]),
  dish("dex", 1, "Honey Grape Juice", 10, 2, 2, 1, [
    ["Honey", 1],
    ["Grape", 2],
    ["Red Potion", 1],
  ]),
  dish("dex", 2, "Chocolate Mousse Cake", 20, 2, 2, 2, [
    ["Cacao", 10],
    ["Piece of Cake", 1],
    ["Milk", 1],
    ["China", 1],
  ]),
  dish("dex", 3, "Fruit Mix", 20, 2, 2, 3, [
    ["Orange", 5],
    ["Strawberry", 5],
    ["Apple", 5],
    ["Banana", 5],
    ["Yellow Spice", 1],
  ]),
  dish("dex", 4, "Cream Sandwich", 50, 2, 2, 4, [
    ["Bread", 5],
    ["Cheese", 10],
    ["Yellow Herb", 10],
    ["Milk", 15],
    ["Meat", 1],
    ["Sweet Sauce", 1],
  ]),
  dish("dex", 5, "Green Salad", 20, 5, 5, 5, [
    ["Hinalle Leaflet", 2],
    ["Aloe Leaflet", 3],
    ["Sharp Leaf", 10],
    ["Huge Leaf", 6],
    ["Sweet Sauce", 1],
    ["Yellow Spice", 1],
  ]),
  dish("dex", 6, "Peach Cake", 80, 5, 6, 6, [
    ["Solid Peach", 20],
    ["Piece of Cake", 10],
    ["Cheese", 10],
    ["Orange Juice", 5],
    ["Milk", 10],
    ["Sweet Sauce", 1],
  ]),
  dish("dex", 7, "Soul Haunted Bread", 80, 5, 7, 7, [
    ["Ment", 5],
    ["Amulet", 5],
    ["Unripe Apple", 2],
    ["Bread", 10],
    ["Sweet Sauce", 1],
    ["Mastela Fruit", 5],
  ]),
  dish("dex", 8, "Special Toast", 100, 5, 8, 8, [
    ["Royal Jelly", 2],
    ["Strawberry", 10],
    ["Cheese", 10],
    ["Bread", 10],
    ["Meat", 5],
    ["Spicy Sauce", 1],
    ["Sweet Sauce", 1],
  ]),
  dish("dex", 9, "Heavenly Fruit Juice", 50, 5, 9, 9, [
    ["Unripe Apple", 5],
    ["Orange", 10],
    ["Strawberry", 10],
    ["Tropical Banana", 1],
    ["Grape Juice", 5],
    ["Alcohol", 2],
    ["Red Spice", 1],
  ]),
  dish("dex", 10, "Hwergelmir's Tonic", 100, 10, 10, 10, [
    ["Yggdrasil Berry", 1],
    ["Ice Cubic", 10],
    ["Bacillus", 10],
    ["Royal Jelly", 4],
    ["Alcohol", 5],
    ["Prickly Fruit", 2],
    ["Illusion Flower", 1],
    ["Concentration Potion", 3],
  ]),
  dish("agi", 1, "Frog Egg Squid Ink Soup", 10, 3, 1, 1, [
    ["Spawn", 10],
    ["Squid Ink", 1],
    ["Bag of Grain", 1],
  ]),
  dish("agi", 2, "Smooth Noodle", 10, 3, 1, 2, [
    ["Bag of Grain", 1],
    ["Savory Sauce", 1],
    ["Jack o' Pumpkin", 5],
    ["Carrot", 3],
  ]),
  dish("agi", 3, "Tentacle Cheese Gratin", 50, 3, 1, 3, [
    ["Tentacle", 10],
    ["Cheese", 10],
    ["Yam", 5],
    ["Sweet Sauce", 1],
  ]),
  dish("agi", 4, "Lutie Cold Noodle", 40, 3, 1, 4, [
    ["Ice Cubic", 10],
    ["Bag of Grain", 3],
    ["Spicy Sauce", 1],
    ["Carrot", 10],
    ["Jack o' Pumpkin", 10],
  ]),
  dish("agi", 5, "Steamed Bat Wing in Pumpkin", 50, 6, 2, 5, [
    ["Wing of Red Bat", 20],
    ["Hinalle Leaflet", 10],
    ["Red Herb", 10],
    ["Jack o' Pumpkin", 20],
    ["Pot", 1],
  ]),
  dish("agi", 6, "Chile Shrimp Gratin", 80, 7, 2, 6, [
    ["Lemon", 20],
    ["Red Chile", 20],
    ["Shrimp", 20],
    ["Sweet Sauce", 1],
  ]),
  dish("agi", 7, "Steamed Alligator with Vegetable", 80, 8, 2, 7, [
    ["Anolian Skin", 10],
    ["Aloe Leaflet", 10],
    ["Yellow Herb", 10],
    ["Jack o' Pumpkin", 10],
    ["Carrot", 10],
    ["Yellow Spice", 1],
  ]),
  dish("agi", 8, "Incredibly Spicy Curry", 100, 9, 2, 8, [
    ["Aloe Vera", 1],
    ["Hinalle Leaflet", 10],
    ["Jack o' Pumpkin", 10],
    ["Carrot", 10],
    ["Spicy Sauce", 1],
    ["Meat", 10],
  ]),
  dish("agi", 9, "Special Meat Stew", 100, 10, 2, 9, [
    ["Royal Jelly", 5],
    ["Shoot", 20],
    ["Yellow Herb", 5],
    ["White Herb", 10],
    ["Red Herb", 5],
    ["Meat", 10],
    ["Savory Sauce", 4],
  ]),
  dish("agi", 10, "Steamed Desert Scorpions", 100, 15, 5, 10, [
    ["Scorpion Tail", 20],
    ["Scorpion Nipper", 20],
    ["Aloe Vera", 2],
    ["Bitter Herb", 3],
    ["Royal Jelly", 10],
    ["Yggdrasil Leaf", 3],
    ["Spicy Sauce", 1],
    ["Pot", 1],
  ]),
  dish("luk", 1, "Fried Monkey Tails", 6, 3, 2, 1, [
    ["Yoyo Tail", 5],
    ["Old Frying Pan", 1],
    ["Cooking Oil", 1],
  ]),
  dish("luk", 2, "Mixed Juice", 20, 3, 2, 2, [
    ["Apple Juice", 1],
    ["Carrot Juice", 2],
    ["Grape Juice", 1],
    ["Orange Juice", 2],
  ]),
  dish("luk", 3, "Fried Sweet Potato", 50, 4, 2, 3, [
    ["Yam", 10],
    ["Sweet Potato", 1],
    ["Potato", 10],
    ["Sweet Sauce", 1],
  ]),
  dish("luk", 4, "Steamed Ancient Lips", 50, 4, 2, 4, [
    ["Ancient Lips", 10],
    ["Raccoon Leaf", 10],
    ["White Herb", 10],
    ["Fresh Fish", 5],
    ["Sweet Sauce", 2],
  ]),
  dish("luk", 5, "Fried Scorpion Tails", 40, 5, 2, 5, [
    ["Scorpion Tail", 20],
    ["Bug Leg", 10],
    ["Huge Leaf", 10],
    ["Old Frying Pan", 2],
    ["Cooking Oil", 1],
  ]),
  dish("luk", 6, "Lucky Soup", 30, 6, 3, 6, [
    ["Reptile Tongue", 5],
    ["Tongue", 5],
    ["Clover", 10],
    ["Witch Starsand", 10],
    ["Aloe", 1],
  ]),
  dish("luk", 7, "Assorted Shish Kebob", 80, 7, 3, 7, [
    ["Scale Shell", 10],
    ["Fin", 5],
    ["Soft Blade of Grass", 10],
    ["Clam Flesh", 10],
    ["Meat", 5],
    ["Edible Mushroom", 10],
  ]),
  dish("luk", 8, "Strawberry Flavored Rice Ball", 40, 8, 3, 8, [
    ["Strawberry", 10],
    ["Fig Leaf", 10],
    ["Bag of Grain", 5],
    ["Yellow Spice", 1],
    ["Red Spice", 2],
    ["Savory Sauce", 1],
  ]),
  dish("luk", 9, "Blood Flavored Soda", 100, 10, 4, 9, [
    ["Animal Gore", 1],
    ["Anodyne", 2],
    ["Aloe Vera", 2],
    ["Alcohol", 2],
    ["Royal Jelly", 6],
    ["Apple Juice", 10],
    ["Red Spice", 1],
  ]),
  dish("luk", 10, "Cooked Nine Tail's Tails", 50, 14, 8, 10, [
    ["Nine Tails", 10],
    ["Four Leaf Clover", 2],
    ["Maneater Root", 10],
    ["Sharp Leaf", 10],
    ["Izidor", 2],
    ["Yggdrasil Leaf", 4],
    ["Savory Sauce", 1],
    ["Yellow Spice", 1],
  ]),
];

export const officialIngredients: readonly OfficialIngredient[] = collectIngredients(recipeSources);
export const officialRecipes: readonly OfficialRecipe[] = recipeSources.map(toOfficialRecipe);

export function seedKeyFromName(name: string): string {
  const key = name
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!key) {
    throw new Error(`Cannot build a seed key for ${name}.`);
  }
  return key;
}

function dish(
  stat: FoodStat,
  level: number,
  name: string,
  weight: number,
  hpRegen: number,
  spRegen: number,
  statBonus: number,
  lines: ReadonlyArray<readonly [string, number]>,
): RecipeSource {
  return { stat, level, name, weight, hpRegen, spRegen, statBonus, lines };
}

function collectIngredients(sources: readonly RecipeSource[]): OfficialIngredient[] {
  const names = new Set<string>();
  for (const source of sources) {
    for (const [name] of source.lines) {
      names.add(name);
    }
  }
  return [...names]
    .sort((left, right) => left.localeCompare(right, "en"))
    .map((name) => ({
      seedKey: seedKeyFromName(name),
      name,
      referencePrice: npcReferencePrices[name] ?? null,
    }));
}

function toOfficialRecipe(source: RecipeSource): OfficialRecipe {
  return {
    seedKey: seedKeyFromName(source.name),
    name: source.name,
    stat: source.stat,
    level: source.level,
    weight: source.weight,
    hpRegen: source.hpRegen,
    spRegen: source.spRegen,
    statBonus: source.statBonus,
    cookbookLabel: `Level ${source.level} Cookbook`,
    items: source.lines.map(([ingredientName, quantity]) => ({
      ingredientName,
      ingredientSeedKey: seedKeyFromName(ingredientName),
      quantity,
    })),
  };
}
