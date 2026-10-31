import type { CatalogRecipe } from "@/db/catalog";
import { foodStats, type FoodStat } from "@/domain/catalog/food-stat";

type LeveledDish = {
  name: string;
  stat: FoodStat;
  level: number;
};

export type LevelGroup<T extends LeveledDish = CatalogRecipe> = {
  level: number;
  dishes: T[];
};

export function groupByLevel<T extends LeveledDish>(dishes: readonly T[]): LevelGroup<T>[] {
  const byLevel = new Map<number, T[]>();
  for (const dish of dishes) {
    const group = byLevel.get(dish.level) ?? [];
    group.push(dish);
    byLevel.set(dish.level, group);
  }
  return [...byLevel.entries()]
    .sort(([left], [right]) => left - right)
    .map(([level, group]) => ({
      level,
      dishes: group.sort((left, right) => {
        const statOrder = foodStats.indexOf(left.stat) - foodStats.indexOf(right.stat);
        if (statOrder !== 0) {
          return statOrder;
        }
        return left.name.localeCompare(right.name, "en");
      }),
    }));
}
