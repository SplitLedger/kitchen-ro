import {
  Badge,
  Flex,
  Heading,
  Link as ThemeLink,
  Select,
  Table,
  Text,
  TextField,
} from "@radix-ui/themes";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FoodStatBadge } from "@/components/food-stat-badge";
import { foodStatLabels, foodStats, isFoodStat, type FoodStat } from "@/domain/catalog/food-stat";
import { listCatalogRecipes, type CatalogRecipe } from "@/db/catalog";
import { openAppDatabase } from "@/db/open";

export const Route = createFileRoute("/catalog/")({
  loader: async () => {
    const database = await openAppDatabase();
    return listCatalogRecipes(database.db);
  },
  component: CatalogPage,
  pendingComponent: CatalogPending,
  errorComponent: CatalogError,
});

function CatalogPending() {
  return <Text color="gray">Loading the catalog…</Text>;
}

function CatalogError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "Could not load the catalog.";
  return <Text color="red">{message}</Text>;
}

function CatalogPage() {
  const dishes = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [stat, setStat] = useState<"all" | FoodStat>("all");
  const [level, setLevel] = useState<"all" | number>("all");
  const filtered = filterDishes(dishes, query, stat, level);
  const needle = query.trim().toLowerCase();

  function onStatChange(value: string) {
    setStat(value === "all" || isFoodStat(value) ? value : "all");
  }

  function onLevelChange(value: string) {
    if (value === "all") {
      setLevel("all");
      return;
    }
    const next = Number(value);
    setLevel(Number.isInteger(next) ? next : "all");
  }

  return (
    <Flex direction="column" gap="4" maxWidth="64rem">
      <Flex direction="column" gap="2">
        <Heading as="h1" size="6">
          Catalog
        </Heading>
        <Text as="p" color="gray">
          Official cooking dishes. Search matches a food name or any ingredient on the recipe.
        </Text>
      </Flex>
      <Flex align="center" gap="3" wrap="wrap">
        <TextField.Root
          aria-label="Search by food or ingredient"
          placeholder="Search by food or ingredient"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          style={{ minWidth: "16rem" }}
        />
        <Select.Root value={stat} onValueChange={onStatChange}>
          <Select.Trigger aria-label="Stat" />
          <Select.Content>
            <Select.Item value="all">All stats</Select.Item>
            {foodStats.map((foodStat) => (
              <Select.Item key={foodStat} value={foodStat}>
                {foodStatLabels[foodStat]}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
        <Select.Root value={level === "all" ? "all" : String(level)} onValueChange={onLevelChange}>
          <Select.Trigger aria-label="Level" />
          <Select.Content>
            <Select.Item value="all">All levels</Select.Item>
            {Array.from({ length: 10 }, (_, index) => {
              const foodLevel = String(index + 1);
              return (
                <Select.Item key={foodLevel} value={foodLevel}>
                  Level {foodLevel}
                </Select.Item>
              );
            })}
          </Select.Content>
        </Select.Root>
      </Flex>
      <Text color="gray" size="2">
        {filtered.length} {filtered.length === 1 ? "dish" : "dishes"}
      </Text>
      {filtered.length === 0 ? (
        <Text color="gray">No dishes match this filter.</Text>
      ) : (
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Food</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Stat</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Level</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {filtered.map((dish) => {
              const matched = needle
                ? dish.items
                    .filter((item) => item.name.toLowerCase().includes(needle))
                    .map((item) => item.name)
                : [];
              return (
                <Table.Row key={dish.id}>
                  <Table.Cell>
                    <Flex direction="column" gap="1">
                      <ThemeLink asChild weight="medium">
                        <Link params={{ recipeId: String(dish.id) }} to="/catalog/$recipeId">
                          {dish.name}
                        </Link>
                      </ThemeLink>
                      {matched.length > 0 ? (
                        <Text color="gray" size="1">
                          {matched.join(", ")}
                        </Text>
                      ) : null}
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <FoodStatBadge stat={dish.stat} />
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color="gray" variant="soft">
                      {dish.level}
                    </Badge>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
      )}
    </Flex>
  );
}

function filterDishes(
  dishes: CatalogRecipe[],
  query: string,
  stat: "all" | FoodStat,
  level: "all" | number,
): CatalogRecipe[] {
  const needle = query.trim().toLowerCase();
  return dishes.filter((dish) => {
    if (stat !== "all" && dish.stat !== stat) {
      return false;
    }
    if (level !== "all" && dish.level !== level) {
      return false;
    }
    if (!needle) {
      return true;
    }
    if (dish.name.toLowerCase().includes(needle)) {
      return true;
    }
    return dish.items.some((item) => item.name.toLowerCase().includes(needle));
  });
}
