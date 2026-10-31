import { Card, Flex, Grid, Heading, Link as ThemeLink } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import { CatalogBadges } from "@/components/CatalogBadges";
import { FoodStatBadge } from "@/components/FoodStatBadge";
import type { LevelGroup } from "@/pages/catalog/groupByLevel";

export function LevelBox({ group }: { group: LevelGroup }) {
  return (
    <Card size="2" variant="surface">
      <Flex direction="column" gap="3">
        <Heading as="h3" size="3">
          Level {group.level}
        </Heading>
        <Grid columns={{ initial: "1", xs: "2", md: "3", lg: "4", xl: "6" }} gap="3">
          {group.dishes.map((dish) => (
            <Flex key={dish.id} align="center" gap="2" wrap="wrap">
              <FoodStatBadge stat={dish.stat} />
              <ThemeLink asChild>
                <Link params={{ recipeId: String(dish.id) }} to="/catalog/$recipeId">
                  {dish.name}
                </Link>
              </ThemeLink>
              <CatalogBadges
                archived={dish.archived}
                custom={dish.origin === "custom"}
                edited={dish.diverged}
              />
            </Flex>
          ))}
        </Grid>
      </Flex>
    </Card>
  );
}
