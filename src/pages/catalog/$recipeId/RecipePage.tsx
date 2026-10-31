import {
  Badge,
  Box,
  Button,
  Callout,
  Flex,
  Grid,
  Heading,
  Link as ThemeLink,
  Table,
  Text,
} from "@radix-ui/themes";
import { Link, getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { CatalogBadges } from "@/components/CatalogBadges";
import { CatalogRecordActions } from "@/components/CatalogRecordActions";
import { FoodStatBadge } from "@/components/FoodStatBadge";
import {
  formatReferencePrice,
  formatPriceRange,
  formatUnitValue,
} from "@/components/formatReferencePrice";
import { deleteRecipe, resetRecipe, setRecipeArchived } from "@/db/catalog-edit";
import { kitDiffersFromSeed } from "@/domain/catalog/edit";
import { formatSuccessRate } from "@/domain/cooking/success";
import { lookupSummary, priceBasisLabels, unitPriceForBasis } from "@/domain/inventory/prices";
import { foodStatLabels } from "@/domain/catalog/food-stat";
import { Fact } from "@/pages/catalog/$recipeId/Fact";
import { FoodCost } from "@/pages/catalog/$recipeId/FoodCost";
import { isDefaultKit, kitRates, SuccessRates } from "@/pages/catalog/$recipeId/SuccessRates";
import { useAppState } from "@/providers/AppStateProvider";

const routeApi = getRouteApi("/catalog/$recipeId/");

export function RecipePage() {
  const { recipe, kits, prices } = routeApi.useLoaderData();
  const { database, settings } = useAppState();
  const currencyLabel = settings.currencyLabel;
  const router = useRouter();
  const navigate = useNavigate();

  return (
    <Flex direction="column" gap="5">
      <ThemeLink asChild>
        <Link to="/catalog">Back to catalog</Link>
      </ThemeLink>
      <Flex align="start" justify="between" gap="3" wrap="wrap">
        <Flex direction="column" gap="3">
          <Heading as="h1" size="6">
            {recipe.name}
          </Heading>
          <Flex align="center" gap="2" wrap="wrap">
            <FoodStatBadge stat={recipe.stat} />
            <Badge color="gray" variant="soft">
              Level {recipe.level}
            </Badge>
            <CatalogBadges
              archived={recipe.archived}
              custom={recipe.origin === "custom"}
              edited={recipe.diverged}
            />
          </Flex>
        </Flex>
        <Button asChild>
          <Link params={{ recipeId: String(recipe.id) }} to="/catalog/$recipeId/edit">
            Edit
          </Link>
        </Button>
      </Flex>
      {recipe.archived ? (
        <Callout.Root color="gray" variant="surface">
          <Callout.Text>This dish is archived, so it is hidden from the catalog list.</Callout.Text>
        </Callout.Root>
      ) : null}
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
      <Grid columns={{ initial: "1", lg: "2" }} gap="5">
        <Box minWidth="0">
          <SuccessRates
            foodLevel={recipe.level}
            ingredientRowCount={recipe.items.length}
            kits={kits}
            settings={settings}
          />
        </Box>
        <Box minWidth="0">
          <FoodCost kits={kits} prices={prices} recipe={recipe} settings={settings} />
        </Box>
      </Grid>
      <CatalogRecordActions
        archived={recipe.archived}
        onArchive={async (archived) => {
          await setRecipeArchived(database.db, recipe.id, archived);
          await router.invalidate();
          if (archived) {
            await navigate({ to: "/catalog" });
          }
        }}
        reset={
          recipe.origin === "official" && recipe.diverged
            ? {
                title: "Reset this dish?",
                description: `Restore ${recipe.name} from the official seed. The name, stats, cookbook note, and ingredient lines are replaced.`,
                onAction: async () => {
                  await resetRecipe(database.db, recipe.id);
                  await router.invalidate();
                },
              }
            : undefined
        }
        deleteAction={
          recipe.origin === "custom"
            ? {
                title: "Delete this dish?",
                description: `Delete ${recipe.name}? This cannot be undone.`,
                onAction: async () => {
                  await deleteRecipe(database.db, recipe.id);
                  await router.invalidate();
                  await navigate({ to: "/catalog" });
                },
              }
            : undefined
        }
      />
      <Flex direction="column" gap="2">
        <Heading as="h2" size="4">
          Ingredients
        </Heading>
        <Text color="gray" size="2">
          {recipe.items.length} {recipe.items.length === 1 ? "ingredient" : "ingredients"}. NPC
          references are shop hints. The unit price is the{" "}
          {priceBasisLabels[settings.priceBasis].toLowerCase()} of lots still on hand.
        </Text>
        <Box style={{ overflowX: "auto" }}>
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell justify="end">Quantity</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Ingredient</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>NPC reference</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">On hand</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Unit price</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Range</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {recipe.items.map((item) => {
                const summary = lookupSummary(prices, "ingredient", item.ingredientId);
                const unitPrice = unitPriceForBasis(summary, settings.priceBasis);
                return (
                  <Table.Row key={item.ingredientId}>
                    <Table.Cell justify="end">{item.quantity}</Table.Cell>
                    <Table.Cell>{item.name}</Table.Cell>
                    <Table.Cell>
                      <Text color="gray">
                        {formatReferencePrice(item.referencePrice, currencyLabel)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell justify="end">{summary?.onHand ?? 0}</Table.Cell>
                    <Table.Cell>
                      <Text color={unitPrice === null ? "gray" : undefined}>
                        {formatUnitValue(unitPrice, currencyLabel)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text color={summary ? undefined : "gray"}>
                        {formatPriceRange(summary?.minimum, summary?.maximum, currencyLabel)}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Box>
      </Flex>
      <Flex direction="column" gap="2">
        <Flex align="center" justify="between" gap="3" wrap="wrap">
          <Heading as="h2" size="4">
            Cooking kits
          </Heading>
          <Button asChild variant="soft">
            <Link to="/catalog/kits/new">New kit</Link>
          </Button>
        </Flex>
        <Text as="p" color="gray" size="2">
          A kit is consumed once per attempt. The unit price is the{" "}
          {priceBasisLabels[settings.priceBasis].toLowerCase()} of lots still on hand. The rates
          below use this same cook profile.
        </Text>
        <Box style={{ overflowX: "auto" }}>
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Kit</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Produce value</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">Minimum</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">Average</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">Maximum</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>NPC reference</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">On hand</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Unit price</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Range</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {kits.map((kit) => {
                const rates = kitRates(kit, settings, recipe.level, recipe.items.length);
                const summary = lookupSummary(prices, "kit", kit.id);
                const unitPrice = unitPriceForBasis(summary, settings.priceBasis);
                return (
                  <Table.Row key={kit.id}>
                    <Table.Cell>
                      <Flex align="center" gap="2" wrap="wrap">
                        <Text>{kit.name}</Text>
                        {isDefaultKit(kit, settings.defaultKitKey) ? (
                          <Badge color="orange" variant="soft">
                            Default
                          </Badge>
                        ) : null}
                        {kit.alwaysSuccess ? (
                          <Badge color="green" variant="soft">
                            Always succeeds
                          </Badge>
                        ) : null}
                        <CatalogBadges
                          custom={kit.origin === "custom"}
                          edited={kitDiffersFromSeed(kit)}
                        />
                      </Flex>
                    </Table.Cell>
                    <Table.Cell>{kit.produceValue}</Table.Cell>
                    <Table.Cell justify="end">{formatSuccessRate(rates.minBp)}</Table.Cell>
                    <Table.Cell justify="end">{formatSuccessRate(rates.avgBp)}</Table.Cell>
                    <Table.Cell justify="end">{formatSuccessRate(rates.maxBp)}</Table.Cell>
                    <Table.Cell>
                      <Text color="gray">
                        {formatReferencePrice(kit.referencePrice, currencyLabel)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell justify="end">{summary?.onHand ?? 0}</Table.Cell>
                    <Table.Cell>
                      <Text color={unitPrice === null ? "gray" : undefined}>
                        {formatUnitValue(unitPrice, currencyLabel)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text color={summary ? undefined : "gray"}>
                        {formatPriceRange(summary?.minimum, summary?.maximum, currencyLabel)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <ThemeLink asChild>
                        <Link params={{ kitId: String(kit.id) }} to="/catalog/kits/$kitId">
                          Edit
                        </Link>
                      </ThemeLink>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Box>
      </Flex>
    </Flex>
  );
}
