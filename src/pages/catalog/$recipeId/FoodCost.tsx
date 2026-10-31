import { Box, Callout, Flex, Heading, Link as ThemeLink, Table, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import { formatMoney, formatPriceRange, formatUnitValue } from "@/components/formatReferencePrice";
import type { CatalogKit, CatalogRecipe } from "@/db/catalog";
import type { Settings } from "@/db/schema";
import { resolveDefaultKit } from "@/domain/cooking/profile";
import { cookingSuccessRates, formatSuccessRate, isCertainSuccess } from "@/domain/cooking/success";
import {
  lookupSummary,
  priceBasisLabels,
  unitPriceForBasis,
  type PriceBook,
} from "@/domain/inventory/prices";
import { attemptCost, quoteFood, type CostLine } from "@/domain/pricing/cost";
import { SaleOverrideForm } from "@/pages/catalog/$recipeId/SaleOverrideForm";

export function FoodCost({
  recipe,
  kits,
  settings,
  prices,
}: {
  recipe: CatalogRecipe;
  kits: readonly CatalogKit[];
  settings: Settings;
  prices: PriceBook;
}) {
  const currencyLabel = settings.currencyLabel;
  const basis = settings.priceBasis;
  const defaultKit = resolveDefaultKit(kits, settings.defaultKitKey);
  const rates = defaultKit
    ? cookingSuccessRates(
        {
          baseLevel: settings.baseLevel,
          dex: settings.dex,
          luk: settings.luk,
          mastery: settings.mastery,
        },
        defaultKit,
        recipe.level,
        recipe.items.length,
      )
    : null;
  const lines: Array<CostLine & { minimum: number | null; maximum: number | null }> = defaultKit
    ? [
        ...recipe.items.map((item) => {
          const summary = lookupSummary(prices, "ingredient", item.ingredientId);
          return {
            name: item.name,
            quantity: item.quantity,
            unitValue: unitPriceForBasis(summary, basis),
            minimum: summary?.minimum ?? null,
            maximum: summary?.maximum ?? null,
          };
        }),
        (() => {
          const summary = lookupSummary(prices, "kit", defaultKit.id);
          return {
            name: defaultKit.name,
            quantity: 1,
            unitValue: unitPriceForBasis(summary, basis),
            minimum: summary?.minimum ?? null,
            maximum: summary?.maximum ?? null,
          };
        })(),
      ]
    : [];
  const attempt = defaultKit ? attemptCost(lines) : null;
  const quote =
    attempt?.status === "ready" && rates
      ? quoteFood({
          oneAttemptCost: attempt.total,
          minimumRateBp: rates.minBp,
          averageRateBp: rates.avgBp,
          marginPercent: settings.marginPercent,
          salePriceOverride: recipe.salePriceOverride,
        })
      : null;

  return (
    <Flex direction="column" gap="3">
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Heading as="h2" size="4">
          Cost of one food
        </Heading>
        <Flex gap="3" wrap="wrap">
          <ThemeLink asChild>
            <Link to="/inventory">Edit inventory</Link>
          </ThemeLink>
          <ThemeLink asChild>
            <Link to="/settings">Edit margin</Link>
          </ThemeLink>
        </Flex>
      </Flex>
      <Text color="gray" size="2">
        One attempt is the ingredients plus one {defaultKit?.name ?? "cooking kit"}. The unit price
        is the {priceBasisLabels[basis].toLowerCase()} of lots still on hand. The range is the
        lowest and highest of those lots. The cost of one success divides that attempt by the
        success rate and rounds up. Sale adds {settings.marginPercent}% and rounds up to a whole{" "}
        {currencyLabel}.
      </Text>
      {defaultKit === null ? (
        <Callout.Root color="gray" variant="surface">
          <Callout.Text>Choose a default kit in Settings to price one success.</Callout.Text>
        </Callout.Root>
      ) : null}
      {attempt?.status === "missing" ? (
        <Callout.Root color="orange" variant="surface">
          <Callout.Text>
            Set a price for {attempt.missingNames.join(", ")} before this dish can show a cost. Add
            a lot that is still on hand.
          </Callout.Text>
        </Callout.Root>
      ) : null}
      {quote ? (
        <Flex direction="column" gap="3">
          <Box style={{ overflowX: "auto" }}>
            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell justify="end">Quantity</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Item</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell justify="end">
                    Unit price ({priceBasisLabels[basis].toLowerCase()})
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell justify="end">Range</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell justify="end">Extended</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {lines.map((line, index) => {
                  const extended = line.unitValue === null ? null : line.quantity * line.unitValue;
                  return (
                    <Table.Row key={`${line.name}-${index}`}>
                      <Table.Cell justify="end">{line.quantity}</Table.Cell>
                      <Table.Cell>{line.name}</Table.Cell>
                      <Table.Cell justify="end">
                        <Text color={line.unitValue === null ? "gray" : undefined}>
                          {formatUnitValue(line.unitValue, currencyLabel)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell justify="end">
                        <Text color={line.minimum == null ? "gray" : undefined}>
                          {formatPriceRange(line.minimum, line.maximum, currencyLabel)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell justify="end">
                        {extended === null ? "Not set" : formatMoney(extended, currencyLabel)}
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
                <Table.Row>
                  <Table.Cell />
                  <Table.RowHeaderCell>One attempt</Table.RowHeaderCell>
                  <Table.Cell />
                  <Table.Cell />
                  <Table.Cell justify="end">
                    <Text weight="medium">{formatMoney(quote.oneAttemptCost, currencyLabel)}</Text>
                  </Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table.Root>
          </Box>
          {defaultKit && isCertainSuccess(defaultKit) ? (
            <Text color="gray" size="2">
              This kit always succeeds, so one success costs the same as one attempt.
            </Text>
          ) : null}
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell />
                <Table.ColumnHeaderCell justify="end">Minimum</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">Average</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              <Table.Row>
                <Table.RowHeaderCell>Success rate</Table.RowHeaderCell>
                <Table.Cell justify="end">{formatSuccessRate(quote.minimum.rateBp)}</Table.Cell>
                <Table.Cell justify="end">{formatSuccessRate(quote.average.rateBp)}</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.RowHeaderCell>Cost of 1 success</Table.RowHeaderCell>
                <Table.Cell justify="end">
                  {formatMoney(quote.minimum.unitCost, currencyLabel)}
                </Table.Cell>
                <Table.Cell justify="end">
                  {formatMoney(quote.average.unitCost, currencyLabel)}
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.RowHeaderCell>Margin sale ({settings.marginPercent}%)</Table.RowHeaderCell>
                <Table.Cell justify="end">
                  {formatMoney(quote.minimum.marginSale, currencyLabel)}
                </Table.Cell>
                <Table.Cell justify="end">
                  {formatMoney(quote.average.marginSale, currencyLabel)}
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table.Root>
          {recipe.salePriceOverride !== null ? (
            <Callout.Root color="orange" variant="surface">
              <Callout.Text>
                This dish sells for {formatMoney(recipe.salePriceOverride, currencyLabel)}. That
                replaces the margin sale at both rates.
              </Callout.Text>
            </Callout.Root>
          ) : null}
        </Flex>
      ) : null}
      <SaleOverrideForm
        currencyLabel={currencyLabel}
        recipeId={recipe.id}
        salePriceOverride={recipe.salePriceOverride}
      />
    </Flex>
  );
}
