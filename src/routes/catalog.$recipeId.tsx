import { Badge, Callout, Flex, Heading, Link as ThemeLink, Table, Text } from "@radix-ui/themes";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { FoodStatBadge } from "@/components/food-stat-badge";
import { foodStatLabels } from "@/domain/catalog/food-stat";
import { getCatalogRecipe, listCookingKits } from "@/db/catalog";
import { openAppDatabase } from "@/db/open";

export const Route = createFileRoute("/catalog/$recipeId")({
  loader: async ({ params }) => {
    const recipeId = Number(params.recipeId);
    if (!Number.isInteger(recipeId) || recipeId < 1) {
      throw notFound();
    }
    const database = await openAppDatabase();
    const recipe = await getCatalogRecipe(database.db, recipeId);
    if (!recipe) {
      throw notFound();
    }
    const kits = await listCookingKits(database.db);
    const settings = await database.readSettings();
    return { recipe, kits, currencyLabel: settings.currencyLabel };
  },
  component: RecipePage,
  pendingComponent: RecipePending,
  errorComponent: RecipeError,
  notFoundComponent: RecipeMissing,
});

function RecipePending() {
  return <Text color="gray">Loading the recipe…</Text>;
}

function RecipeError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "Could not load this recipe.";
  return <Text color="red">{message}</Text>;
}

function RecipeMissing() {
  return (
    <Flex direction="column" gap="3" maxWidth="40rem">
      <Heading as="h1" size="6">
        Dish not found
      </Heading>
      <Text color="gray">That recipe is not in the catalog.</Text>
      <ThemeLink asChild>
        <Link to="/catalog">Back to catalog</Link>
      </ThemeLink>
    </Flex>
  );
}

function RecipePage() {
  const { recipe, kits, currencyLabel } = Route.useLoaderData();

  return (
    <Flex direction="column" gap="5" maxWidth="48rem">
      <ThemeLink asChild>
        <Link to="/catalog">Back to catalog</Link>
      </ThemeLink>
      <Flex direction="column" gap="3">
        <Heading as="h1" size="6">
          {recipe.name}
        </Heading>
        <Flex align="center" gap="2" wrap="wrap">
          <FoodStatBadge stat={recipe.stat} />
          <Badge color="gray" variant="soft">
            Level {recipe.level}
          </Badge>
        </Flex>
        <Flex gap="5" wrap="wrap">
          <Fact label="Weight" value={String(recipe.weight)} />
          <Fact label="HP regen" value={`${recipe.hpRegen}%`} />
          <Fact label="SP regen" value={`${recipe.spRegen}%`} />
          <Fact label="Stat bonus" value={`+${recipe.statBonus} ${foodStatLabels[recipe.stat]}`} />
        </Flex>
        <Callout.Root color="gray" variant="surface">
          <Callout.Text>
            Needs {recipe.cookbookLabel}. It is not consumed and is not part of the cost.
          </Callout.Text>
        </Callout.Root>
      </Flex>
      <Flex direction="column" gap="2">
        <Heading as="h2" size="4">
          Ingredients
        </Heading>
        <Text color="gray" size="2">
          {recipe.items.length} {recipe.items.length === 1 ? "ingredient" : "ingredients"}. NPC
          references are shop hints, not your prices.
        </Text>
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell justify="end">Quantity</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Ingredient</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>NPC reference</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {recipe.items.map((item) => (
              <Table.Row key={`${item.name}-${item.quantity}`}>
                <Table.Cell justify="end">{item.quantity}</Table.Cell>
                <Table.Cell>{item.name}</Table.Cell>
                <Table.Cell>
                  <Text color="gray">{referenceHint(item.referencePrice, currencyLabel)}</Text>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Flex>
      <Flex direction="column" gap="2">
        <Heading as="h2" size="4">
          Cooking kits
        </Heading>
        <Text as="p" color="gray" size="2">
          A kit is consumed once per attempt.
        </Text>
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Kit</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Produce value</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>NPC reference</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {kits.map((kit) => (
              <Table.Row key={kit.id}>
                <Table.Cell>
                  <Flex align="center" gap="2" wrap="wrap">
                    <Text>{kit.name}</Text>
                    {kit.alwaysSuccess ? (
                      <Badge color="green" variant="soft">
                        Always succeeds
                      </Badge>
                    ) : null}
                  </Flex>
                </Table.Cell>
                <Table.Cell>{kit.produceValue}</Table.Cell>
                <Table.Cell>
                  <Text color="gray">{referenceHint(kit.referencePrice, currencyLabel)}</Text>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Flex>
    </Flex>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Flex direction="column" gap="1">
      <Text color="gray" size="1">
        {label}
      </Text>
      <Text>{value}</Text>
    </Flex>
  );
}

function referenceHint(price: number | null, currencyLabel: string): string {
  if (price === null) {
    return "No NPC price";
  }
  return `${price} ${currencyLabel}`;
}
