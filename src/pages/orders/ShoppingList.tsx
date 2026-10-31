import { Flex, Table, Text } from "@radix-ui/themes";
import { formatMoney, formatPriceRange, formatUnitValue } from "@/components/formatReferencePrice";
import type { OrderPlan } from "@/domain/orders/plan";
import { useAppState } from "@/providers/AppStateProvider";

export function ShoppingList({ plan }: { plan: OrderPlan }) {
  const { settings } = useAppState();
  const currencyLabel = settings.currencyLabel;
  const priced = plan.lines.length > 0;
  const tracksStock = plan.materials.some((material) => material.onHand !== undefined);

  return (
    <Flex direction="column" gap="3">
      {plan.materials.length === 0 ? (
        <Text color="gray">Add a dish to build the shopping list.</Text>
      ) : (
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell justify="end">
                {tracksStock ? "Need" : "Quantity"}
              </Table.ColumnHeaderCell>
              {tracksStock ? (
                <>
                  <Table.ColumnHeaderCell justify="end">On hand</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell justify="end">Short</Table.ColumnHeaderCell>
                </>
              ) : null}
              <Table.ColumnHeaderCell>Item</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell justify="end">Unit price</Table.ColumnHeaderCell>
              {tracksStock ? (
                <Table.ColumnHeaderCell justify="end">Range</Table.ColumnHeaderCell>
              ) : null}
              <Table.ColumnHeaderCell justify="end">Extended</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {plan.materials.map((material) => (
              <Table.Row
                key={`${material.kind}-${material.ingredientId ?? material.kitId ?? material.name}`}
              >
                <Table.Cell justify="end">{material.quantity}</Table.Cell>
                {tracksStock ? (
                  <>
                    <Table.Cell justify="end">{material.onHand ?? 0}</Table.Cell>
                    <Table.Cell justify="end">
                      <Text color={material.shortfall ? "red" : "gray"}>
                        {material.shortfall ?? 0}
                      </Text>
                    </Table.Cell>
                  </>
                ) : null}
                <Table.Cell>
                  {material.name}
                  {material.kind === "kit" ? (
                    <Text color="gray" size="1">
                      {" "}
                      · total attempts
                    </Text>
                  ) : null}
                </Table.Cell>
                <Table.Cell justify="end">
                  <Text color={material.unitValue === null ? "gray" : undefined}>
                    {formatUnitValue(material.unitValue, currencyLabel)}
                  </Text>
                </Table.Cell>
                {tracksStock ? (
                  <Table.Cell justify="end">
                    <Text color={material.priceMinimum == null ? "gray" : undefined}>
                      {formatPriceRange(
                        material.priceMinimum,
                        material.priceMaximum,
                        currencyLabel,
                      )}
                    </Text>
                  </Table.Cell>
                ) : null}
                <Table.Cell justify="end">
                  {material.extendedCost === null
                    ? "Not set"
                    : formatMoney(material.extendedCost, currencyLabel)}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}
      {priced ? (
        <Table.Root variant="surface">
          <Table.Body>
            <TotalRow
              label="Statistical food cost"
              value={money(plan.statisticalFoodCost, currencyLabel)}
            />
            <TotalRow label="Gather cost" value={money(plan.gatherCost, currencyLabel)} />
            <TotalRow label="Rounding gap" value={money(plan.roundingGap, currencyLabel)} />
            <TotalRow label="Sale total" value={money(plan.saleTotal, currencyLabel)} />
            <TotalRow label="Profit" value={money(plan.profit, currencyLabel)} />
          </Table.Body>
        </Table.Root>
      ) : null}
      {priced ? (
        <Text color="gray" size="1">
          The rounding gap is the gather cost minus the statistical food cost. It is the extra you
          buy because each dish rounds up on its own.
        </Text>
      ) : null}
    </Flex>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <Table.Row>
      <Table.RowHeaderCell>{label}</Table.RowHeaderCell>
      <Table.Cell justify="end">{value}</Table.Cell>
    </Table.Row>
  );
}

function money(amount: number | null, currencyLabel: string): string {
  if (amount === null) {
    return "Missing prices";
  }
  return formatMoney(amount, currencyLabel);
}
