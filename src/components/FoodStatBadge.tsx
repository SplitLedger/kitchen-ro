import { Badge } from "@radix-ui/themes";
import { foodStatLabels, type FoodStat } from "@/domain/catalog/food-stat";

const colors = {
  str: "red",
  agi: "green",
  vit: "blue",
  int: "purple",
  dex: "orange",
  luk: "amber",
} as const;

export function FoodStatBadge({ stat }: { stat: FoodStat }) {
  return (
    <Badge color={colors[stat]} variant="soft">
      {foodStatLabels[stat]}
    </Badge>
  );
}
