import { Box, Button, Checkbox, Flex, Heading, Table, Text, TextField } from "@radix-ui/themes";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { formatUnitValue } from "@/components/formatReferencePrice";
import type { CatalogIngredient, CatalogKit } from "@/db/catalog";
import { createLot, deleteLot, updateLot } from "@/db/inventory";
import type { InventoryLot } from "@/db/schema";
import { ingredientDiffersFromSeed, kitDiffersFromSeed } from "@/domain/catalog/edit";
import { summarizeLotPrices } from "@/domain/inventory/prices";
import { AddLotDialog } from "@/pages/inventory/AddLotDialog";
import {
  LotDetailsDialog,
  type InventoryRow,
  type LotDraft,
} from "@/pages/inventory/LotDetailsDialog";
import { useAppState } from "@/providers/AppStateProvider";

const routeApi = getRouteApi("/inventory");

export function InventoryPage() {
  const { ingredients, kits, lots, currencyLabel } = routeApi.useLoaderData();
  const { database } = useAppState();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const rows = inventoryRows(ingredients, kits, lots, query, showArchived);
  const selected = rows.find((row) => row.key === selectedKey) ?? null;

  async function refresh() {
    await router.invalidate();
  }

  async function saveLot(lotId: number, values: LotDraft) {
    const lot = lots.find((row) => row.id === lotId);
    if (!lot) {
      throw new Error("That lot is not in inventory.");
    }
    setSaving(true);
    try {
      await updateLot(database.db, lotId, { ...values, acquiredOn: lot.acquiredOn });
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function removeLot(lotId: number) {
    setSaving(true);
    try {
      await deleteLot(database.db, lotId);
      await refresh();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not delete the lot.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Flex direction="column" gap="5">
      <Flex align="start" justify="between" gap="3" wrap="wrap">
        <Flex direction="column" gap="2">
          <Heading as="h1" size="6">
            Inventory
          </Heading>
          <Text as="p" color="gray">
            Only items with a lot are listed. Quantity still on hand sets the minimum, average, and
            maximum unit price.
          </Text>
        </Flex>
        <AddLotDialog
          ingredients={ingredients}
          kits={kits}
          currencyLabel={currencyLabel}
          saving={saving}
          onCreate={async (owner, values) => {
            setSaving(true);
            try {
              await createLot(database.db, { ...owner, ...values });
              await refresh();
            } finally {
              setSaving(false);
            }
          }}
        />
      </Flex>
      <Flex align="center" gap="3" wrap="wrap">
        <TextField.Root
          aria-label="Search inventory"
          placeholder="Search inventory"
          value={query}
          style={{ width: "min(100%, 24rem)" }}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
        <Flex align="center" gap="2">
          <Checkbox
            checked={showArchived}
            id="show-archived-inventory"
            onCheckedChange={(checked) => {
              setShowArchived(checked === true);
            }}
          />
          <Text as="label" htmlFor="show-archived-inventory" size="2">
            Show archived
          </Text>
        </Flex>
      </Flex>
      {rows.length === 0 ? (
        <Text color="gray">{emptyCopy(lots.length, query, showArchived)}</Text>
      ) : (
        <Box style={{ overflowX: "auto" }}>
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Item</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Kind</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">On hand</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">Minimum</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">Average</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">Maximum</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((row) => {
                const summary = summarizeLotPrices(row.lots);
                return (
                  <Table.Row key={row.key}>
                    <Table.RowHeaderCell>{row.name}</Table.RowHeaderCell>
                    <Table.Cell>{row.kind}</Table.Cell>
                    <Table.Cell justify="end">{summary?.onHand ?? 0}</Table.Cell>
                    <Table.Cell justify="end">
                      {formatUnitValue(summary?.minimum ?? null, currencyLabel)}
                    </Table.Cell>
                    <Table.Cell justify="end">
                      {formatUnitValue(summary?.average ?? null, currencyLabel)}
                    </Table.Cell>
                    <Table.Cell justify="end">
                      {formatUnitValue(summary?.maximum ?? null, currencyLabel)}
                    </Table.Cell>
                    <Table.Cell justify="end">
                      <Button
                        type="button"
                        variant="soft"
                        color="gray"
                        onClick={() => {
                          setSelectedKey(row.key);
                        }}
                      >
                        Details
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Box>
      )}
      <LotDetailsDialog
        item={selected}
        currencyLabel={currencyLabel}
        saving={saving}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedKey(null);
          }
        }}
        onUpdate={saveLot}
        onDelete={removeLot}
      />
    </Flex>
  );
}

function inventoryRows(
  ingredients: readonly CatalogIngredient[],
  kits: readonly CatalogKit[],
  lots: readonly InventoryLot[],
  query: string,
  showArchived: boolean,
): InventoryRow[] {
  const ingredientRows: InventoryRow[] = ingredients
    .filter(
      (row) =>
        lots.some((lot) => lot.ingredientId === row.id) &&
        matches(row.name, row.archived, query, showArchived),
    )
    .map((ingredient) => ({
      key: `ingredient:${ingredient.id}`,
      name: ingredient.name,
      kind: "Ingredient",
      referencePrice: ingredient.referencePrice,
      archived: ingredient.archived,
      custom: ingredient.origin === "custom",
      edited: ingredientDiffersFromSeed(ingredient),
      lots: lots.filter((lot) => lot.ingredientId === ingredient.id),
    }));
  const kitRows: InventoryRow[] = kits
    .filter(
      (row) =>
        lots.some((lot) => lot.kitId === row.id) &&
        matches(row.name, row.archived, query, showArchived),
    )
    .map((kit) => ({
      key: `kit:${kit.id}`,
      name: kit.name,
      kind: "Kit",
      referencePrice: kit.referencePrice,
      archived: kit.archived,
      custom: kit.origin === "custom",
      edited: kitDiffersFromSeed(kit),
      lots: lots.filter((lot) => lot.kitId === kit.id),
    }));
  return [...ingredientRows, ...kitRows].sort((left, right) =>
    left.name.localeCompare(right.name, "en"),
  );
}

function matches(name: string, archived: boolean, query: string, showArchived: boolean): boolean {
  if (!showArchived && archived) {
    return false;
  }
  const needle = query.trim().toLowerCase();
  return needle.length === 0 || name.toLowerCase().includes(needle);
}

function emptyCopy(lotCount: number, query: string, showArchived: boolean): string {
  if (query.trim()) {
    return "No lots match that search.";
  }
  if (!showArchived && lotCount > 0) {
    return "Every lot is on an archived item. Show archived to see them.";
  }
  return "Nothing in inventory yet. Add a lot to record stock.";
}
