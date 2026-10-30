export const foodStats = ["str", "agi", "vit", "int", "dex", "luk"] as const;

export type FoodStat = (typeof foodStats)[number];

export const foodStatLabels: Record<FoodStat, string> = {
  str: "STR",
  agi: "AGI",
  vit: "VIT",
  int: "INT",
  dex: "DEX",
  luk: "LUK",
};

export function isFoodStat(value: string): value is FoodStat {
  return (foodStats as readonly string[]).includes(value);
}
