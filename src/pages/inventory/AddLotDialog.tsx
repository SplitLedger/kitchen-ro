import { Button, Dialog, Flex, Select, TextField } from "@radix-ui/themes";
import { useMemo, useState } from "react";
import { FormField } from "@/components/FormField";
import type { CatalogIngredient, CatalogKit } from "@/db/catalog";
import { todayIsoDate } from "@/domain/inventory/lot";
import { emptyLotForm, LotForm } from "@/pages/inventory/LotForm";

type ItemOwner = {
  ingredientId: number | null;
  kitId: number | null;
};

type SavedLot = {
  quantity: number;
  unitPrice: number;
  source: "bought" | "farmed";
  acquiredOn: string;
  note: string;
};

type Choice = {
  key: string;
  name: string;
  kind: "ingredient" | "kit";
  referencePrice: number | null;
  owner: ItemOwner;
};

export function AddLotDialog({
  ingredients,
  kits,
  currencyLabel,
  saving,
  onCreate,
}: {
  ingredients: readonly CatalogIngredient[];
  kits: readonly CatalogKit[];
  currencyLabel: string;
  saving: boolean;
  onCreate: (owner: ItemOwner, values: SavedLot) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [itemKey, setItemKey] = useState("");
  const [itemError, setItemError] = useState<string | null>(null);
  const choices = useMemo(() => catalogChoices(ingredients, kits), [ingredients, kits]);
  const selected = choices.find((choice) => choice.key === itemKey) ?? null;
  const needle = query.trim().toLowerCase();
  const visible = choices.filter(
    (choice) =>
      choice.key === itemKey || needle.length === 0 || choice.name.toLowerCase().includes(needle),
  );
  const ingredientsShown = visible.filter((choice) => choice.kind === "ingredient");
  const kitsShown = visible.filter((choice) => choice.kind === "kit");

  function close() {
    setOpen(false);
    setQuery("");
    setItemKey("");
    setItemError(null);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && saving) {
          return;
        }
        if (!next) {
          close();
          return;
        }
        setOpen(true);
      }}
    >
      <Dialog.Trigger>
        <Button type="button">Add lot</Button>
      </Dialog.Trigger>
      <Dialog.Content maxWidth="28rem">
        <Dialog.Title>Add lot</Dialog.Title>
        <Dialog.Description size="2" mb="3">
          Choose an ingredient or kit, then the quantity and unit price. The lot is dated today.
        </Dialog.Description>
        <LotForm
          key={open ? "open" : "closed"}
          idPrefix="add-lot"
          currencyLabel={currencyLabel}
          referencePrice={selected?.referencePrice ?? null}
          initial={emptyLotForm()}
          quantityMode="create"
          submitLabel="Add lot"
          disabled={saving}
          leading={
            <Flex direction="column" gap="3">
              <FormField id="add-lot-search" label="Find">
                <TextField.Root
                  id="add-lot-search"
                  aria-label="Find an ingredient or kit"
                  placeholder="Search ingredients and kits"
                  value={query}
                  disabled={saving}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </FormField>
              <FormField id="add-lot-item" label="Item" error={itemError ?? undefined}>
                <Select.Root
                  value={itemKey || undefined}
                  disabled={saving}
                  onValueChange={(next) => {
                    setItemKey(next);
                    setItemError(null);
                  }}
                >
                  <Select.Trigger
                    id="add-lot-item"
                    placeholder="Choose an ingredient or kit"
                    style={{ width: "100%" }}
                  />
                  <Select.Content>
                    {ingredientsShown.length > 0 ? (
                      <Select.Group>
                        <Select.Label>Ingredients</Select.Label>
                        {ingredientsShown.map((choice) => (
                          <Select.Item key={choice.key} value={choice.key}>
                            {choice.name}
                          </Select.Item>
                        ))}
                      </Select.Group>
                    ) : null}
                    {kitsShown.length > 0 ? (
                      <Select.Group>
                        <Select.Label>Cooking kits</Select.Label>
                        {kitsShown.map((choice) => (
                          <Select.Item key={choice.key} value={choice.key}>
                            {choice.name}
                          </Select.Item>
                        ))}
                      </Select.Group>
                    ) : null}
                    {visible.length === 0 ? (
                      <Select.Item value="__none" disabled>
                        No matches
                      </Select.Item>
                    ) : null}
                  </Select.Content>
                </Select.Root>
              </FormField>
            </Flex>
          }
          onCancel={close}
          onSubmit={async (values) => {
            if (!selected) {
              setItemError("Choose an ingredient or a cooking kit.");
              return;
            }
            await onCreate(selected.owner, { ...values, acquiredOn: todayIsoDate() });
            close();
          }}
        />
      </Dialog.Content>
    </Dialog.Root>
  );
}

function catalogChoices(
  ingredients: readonly CatalogIngredient[],
  kits: readonly CatalogKit[],
): Choice[] {
  return [
    ...ingredients
      .filter((ingredient) => !ingredient.archived)
      .map((ingredient) => ({
        key: `ingredient:${ingredient.id}`,
        name: ingredient.name,
        kind: "ingredient" as const,
        referencePrice: ingredient.referencePrice,
        owner: { ingredientId: ingredient.id, kitId: null },
      })),
    ...kits
      .filter((kit) => !kit.archived)
      .map((kit) => ({
        key: `kit:${kit.id}`,
        name: kit.name,
        kind: "kit" as const,
        referencePrice: kit.referencePrice,
        owner: { ingredientId: null, kitId: kit.id },
      })),
  ];
}
