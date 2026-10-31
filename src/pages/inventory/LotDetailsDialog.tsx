import { Button, Dialog, Flex, Table, Text } from "@radix-ui/themes";
import { useState } from "react";
import { CatalogBadges } from "@/components/CatalogBadges";
import { ConfirmAction } from "@/components/ConfirmAction";
import { formatMoney, formatReferencePrice } from "@/components/formatReferencePrice";
import type { InventoryLot } from "@/db/schema";
import { summarizeLotPrices } from "@/domain/inventory/prices";
import { formatLotDate } from "@/pages/inventory/format";
import { LotForm, type LotFormValues } from "@/pages/inventory/LotForm";

export type InventoryRow = {
  key: string;
  name: string;
  kind: "Ingredient" | "Kit";
  referencePrice: number | null;
  archived: boolean;
  custom: boolean;
  edited: boolean;
  lots: InventoryLot[];
};

export type LotDraft = {
  quantity: number;
  unitPrice: number;
  source: "bought" | "farmed";
  note: string;
};

export function LotDetailsDialog({
  item,
  currencyLabel,
  saving,
  onOpenChange,
  onUpdate,
  onDelete,
}: {
  item: InventoryRow | null;
  currencyLabel: string;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (lotId: number, values: LotDraft) => Promise<void>;
  onDelete: (lotId: number) => Promise<void>;
}) {
  return (
    <Dialog.Root
      open={item !== null}
      onOpenChange={(open) => {
        if (!open && saving) {
          return;
        }
        onOpenChange(open);
      }}
    >
      <Dialog.Content maxWidth="44rem" style={{ width: "min(44rem, calc(100vw - 2rem))" }}>
        {item ? (
          <LotDetailsBody
            key={item.key}
            item={item}
            currencyLabel={currencyLabel}
            saving={saving}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ) : null}
      </Dialog.Content>
    </Dialog.Root>
  );
}

function LotDetailsBody({
  item,
  currencyLabel,
  saving,
  onUpdate,
  onDelete,
}: {
  item: InventoryRow;
  currencyLabel: string;
  saving: boolean;
  onUpdate: (lotId: number, values: LotDraft) => Promise<void>;
  onDelete: (lotId: number) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const summary = summarizeLotPrices(item.lots);
  const lots = sortLots(item.lots);

  return (
    <>
      <Flex align="center" gap="2" wrap="wrap" mb="1">
        <Dialog.Title mb="0">{item.name}</Dialog.Title>
        <CatalogBadges custom={item.custom} edited={item.edited} archived={item.archived} />
      </Flex>
      <Dialog.Description size="2" mb="3">
        {item.kind}. NPC reference {formatReferencePrice(item.referencePrice, currencyLabel)}.
        {summary
          ? ` On hand ${summary.onHand}.`
          : " No quantity on hand, so this item has no price."}
      </Dialog.Description>
      <Table.Root variant="surface" style={{ width: "100%" }}>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell justify="end">Quantity</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell justify="end">Unit price</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Source</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Added</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Note</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {lots.map((lot) =>
            editingId === lot.id ? (
              <Table.Row key={lot.id}>
                <Table.Cell colSpan={6}>
                  <LotForm
                    idPrefix={`${item.key}-${lot.id}`}
                    currencyLabel={currencyLabel}
                    referencePrice={item.referencePrice}
                    initial={formValues(lot)}
                    quantityMode="edit"
                    submitLabel="Save lot"
                    disabled={saving}
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (values) => {
                      await onUpdate(lot.id, values);
                      setEditingId(null);
                    }}
                  />
                </Table.Cell>
              </Table.Row>
            ) : (
              <Table.Row key={lot.id}>
                <Table.Cell justify="end">{lot.quantity}</Table.Cell>
                <Table.Cell justify="end">{formatMoney(lot.unitPrice, currencyLabel)}</Table.Cell>
                <Table.Cell>{lot.source === "farmed" ? "Farmed" : "Bought"}</Table.Cell>
                <Table.Cell>{formatLotDate(lot.acquiredOn)}</Table.Cell>
                <Table.Cell>
                  <Text color={lot.note ? undefined : "gray"}>{lot.note || "—"}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Flex gap="2" justify="end">
                    <Button
                      type="button"
                      variant="soft"
                      color="gray"
                      disabled={saving}
                      onClick={() => setEditingId(lot.id)}
                    >
                      Edit
                    </Button>
                    <ConfirmAction
                      actionLabel="Delete lot"
                      description={
                        lot.quantity === 0
                          ? "This empty lot is removed. A confirmed order that took from it can put that quantity back."
                          : "This removes the quantity still on this lot. A confirmed order that took from it can put that quantity back."
                      }
                      disabled={saving}
                      title={`Delete this ${item.name} lot?`}
                      triggerLabel="Delete"
                      onConfirm={() => {
                        void onDelete(lot.id);
                      }}
                    />
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ),
          )}
        </Table.Body>
      </Table.Root>
    </>
  );
}

function sortLots(lots: readonly InventoryLot[]): InventoryLot[] {
  return [...lots].sort((left, right) => {
    if (left.acquiredOn !== right.acquiredOn) {
      return left.acquiredOn < right.acquiredOn ? -1 : 1;
    }
    return left.id - right.id;
  });
}

function formValues(lot: InventoryLot): LotFormValues {
  return {
    quantity: String(lot.quantity),
    unitPrice: String(lot.unitPrice),
    source: lot.source,
    note: lot.note,
  };
}
