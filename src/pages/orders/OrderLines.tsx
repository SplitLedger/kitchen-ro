import {
  Badge,
  Button,
  Card,
  Flex,
  Grid,
  Link as ThemeLink,
  Popover,
  Select,
  Text,
} from "@radix-ui/themes";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FoodStatBadge } from "@/components/FoodStatBadge";
import { FormField } from "@/components/FormField";
import { IntegerInput } from "@/components/IntegerInput";
import { formatMoney, formatUnitValue } from "@/components/formatReferencePrice";
import {
  addOrderRecipe,
  removeOrderLine,
  setOrderLineKit,
  setOrderLineQuantity,
  setOrderLineSale,
  type OrderLineView,
  type PickerKit,
  type PickerRecipe,
} from "@/db/orders";
import { Fact } from "@/pages/catalog/$recipeId/Fact";
import { foodStatLabels } from "@/domain/catalog/food-stat";
import { formatSuccessRate } from "@/domain/cooking/success";
import {
  orderPlanMessage,
  parseOrderQuantity,
  parseSaleOverride,
  saleSourceLabels,
  type OrderSaleSource,
  type PlanLine,
} from "@/domain/orders/plan";
import { groupByLevel } from "@/pages/catalog/groupByLevel";
import { useAppState } from "@/providers/AppStateProvider";

export function OrderLines({
  orderId,
  lines,
  recipes,
  kits,
  orderKitName,
  editable,
}: {
  orderId: number;
  lines: readonly OrderLineView[];
  recipes: readonly PickerRecipe[];
  kits: readonly PickerKit[];
  orderKitName: string;
  editable: boolean;
}) {
  const { settings } = useAppState();
  const currencyLabel = settings.currencyLabel;

  return (
    <Flex direction="column" gap="3">
      {editable ? <RecipePicker lines={lines} orderId={orderId} recipes={recipes} /> : null}
      {lines.length === 0 ? (
        <Text color="gray">No dishes on this order yet.</Text>
      ) : (
        <Grid columns={{ initial: "1", lg: "2" }} gap="3">
          {lines.map((line) => (
            <FoodCard
              key={line.lineId}
              currencyLabel={currencyLabel}
              editable={editable}
              kits={kits}
              line={line}
              orderId={orderId}
              orderKitName={orderKitName}
            />
          ))}
        </Grid>
      )}
    </Flex>
  );
}

function RecipePicker({
  orderId,
  lines,
  recipes,
}: {
  orderId: number;
  lines: readonly OrderLineView[];
  recipes: readonly PickerRecipe[];
}) {
  const { database } = useAppState();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pickKey, setPickKey] = useState(0);
  const groups = groupByLevel(recipes);
  const onOrder = new Set(lines.map((line) => line.recipeId));

  async function add(recipeId: number) {
    setAdding(true);
    try {
      await addOrderRecipe(database.db, orderId, recipeId);
      await router.invalidate();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not add that dish.");
    } finally {
      setAdding(false);
      setPickKey((key) => key + 1);
    }
  }

  if (recipes.length === 0) {
    return (
      <Text color="gray">
        No dishes to add. Archived dishes stay off this list until you unarchive them.
      </Text>
    );
  }

  return (
    <Flex
      className="no-print"
      direction="column"
      gap="2"
      maxWidth={{ initial: "100%", md: "36rem" }}
      width="100%"
    >
      <FormField id="order-add-dish" label="Add a dish">
        <Select.Root
          key={pickKey}
          disabled={adding}
          onValueChange={(value) => {
            void add(Number(value));
          }}
        >
          <Select.Trigger
            id="order-add-dish"
            placeholder={adding ? "Adding…" : "Choose a dish"}
            style={{ width: "100%" }}
          />
          <Select.Content position="popper">
            {groups.map((group) => (
              <Select.Group key={group.level}>
                <Select.Label>Level {group.level}</Select.Label>
                {group.dishes.map((recipe) => (
                  <Select.Item key={recipe.id} value={String(recipe.id)}>
                    {dishOptionLabel(recipe, onOrder.has(recipe.id))}
                  </Select.Item>
                ))}
              </Select.Group>
            ))}
          </Select.Content>
        </Select.Root>
      </FormField>
    </Flex>
  );
}

function dishOptionLabel(recipe: PickerRecipe, alreadyOnOrder: boolean): string {
  const label = `${recipe.name} · ${foodStatLabels[recipe.stat]}`;
  return alreadyOnOrder ? `${label} · on order` : label;
}

function FoodCard({
  orderId,
  line,
  kits,
  orderKitName,
  editable,
  currencyLabel,
}: {
  orderId: number;
  line: OrderLineView;
  kits: readonly PickerKit[];
  orderKitName: string;
  editable: boolean;
  currencyLabel: string;
}) {
  const plan = line.plan;
  const name = plan?.name ?? line.fallbackName;
  return (
    <Card size="2" variant="surface">
      <Flex direction="column" gap="4" height="100%">
        <Flex align="start" justify="between" gap="3">
          <Flex direction="column" align="start" gap="2">
            <Flex align="center" gap="2" wrap="wrap">
              {line.recipeId ? (
                <ThemeLink asChild weight="medium">
                  <Link params={{ recipeId: String(line.recipeId) }} to="/catalog/$recipeId">
                    {name}
                  </Link>
                </ThemeLink>
              ) : (
                <Text weight="medium">{name}</Text>
              )}
              {plan ? <FoodStatBadge stat={plan.stat} /> : null}
              {plan ? (
                <Badge color="gray" variant="soft">
                  Level {plan.level}
                </Badge>
              ) : null}
            </Flex>
            {plan ? (
              <Text color="gray" size="1">
                {plan.ingredientRowCount}{" "}
                {plan.ingredientRowCount === 1 ? "ingredient" : "ingredients"}
              </Text>
            ) : (
              <Text color="orange" size="1">
                This dish is no longer in the catalog.
              </Text>
            )}
            {plan && plan.missingNames.length > 0 ? (
              <MissingIngredients names={plan.missingNames} />
            ) : null}
          </Flex>
          {editable ? (
            <Flex className="no-print">
              <RemoveLine lineId={line.lineId} orderId={orderId} />
            </Flex>
          ) : null}
        </Flex>
        <Flex gap="4" wrap="wrap">
          {editable ? (
            <LineKitSelect kits={kits} line={line} orderId={orderId} orderKitName={orderKitName} />
          ) : (
            <Fact label="Cooking kit" value={line.kitName} />
          )}
          <Flex direction="column" gap="1">
            <Text color="gray" size="1">
              Quantity
            </Text>
            {editable ? (
              <QuantityField
                key={`${line.lineId}-${line.quantity}`}
                line={line}
                orderId={orderId}
              />
            ) : (
              <Text>{line.quantity}</Text>
            )}
          </Flex>
          <Fact label="Minimum" value={rateText(plan?.minRateBp)} />
          <Fact label="Average" value={rateText(plan?.avgRateBp)} />
          <Fact label="Maximum" value={rateText(plan?.maxRateBp)} />
          <Flex direction="column" gap="1">
            <Text color="gray" size="1">
              Used
            </Text>
            <Text weight="medium">{rateText(plan?.usedRateBp ?? undefined)}</Text>
          </Flex>
          <Fact
            label="Attempts"
            value={
              plan?.attempts === null || plan?.attempts === undefined ? "—" : String(plan.attempts)
            }
          />
          <Fact
            label="Cost of 1 success"
            value={
              plan?.unitCost === null || plan?.unitCost === undefined
                ? "Not set"
                : formatMoney(plan.unitCost, currencyLabel)
            }
          />
        </Flex>
        <SaleCell currencyLabel={currencyLabel} editable={editable} line={line} orderId={orderId} />
      </Flex>
    </Card>
  );
}

function MissingIngredients({ names }: { names: readonly string[] }) {
  const label = names.length === 1 ? "1 missing ingredient" : `${names.length} missing ingredients`;
  return (
    <>
      <Popover.Root>
        <Popover.Trigger>
          <Button className="no-print" color="orange" size="1" type="button" variant="soft">
            {label}
          </Button>
        </Popover.Trigger>
        <Popover.Content size="1" width="18rem">
          <Flex direction="column" gap="2">
            <Text size="2" weight="medium">
              Missing ingredients
            </Text>
            {names.map((name) => (
              <Text key={name} size="2">
                {name}
              </Text>
            ))}
            <Text color="gray" size="1">
              These have no unit price yet. Add a lot that is still on hand.
            </Text>
          </Flex>
        </Popover.Content>
      </Popover.Root>
      <Text className="print-only" color="orange" size="1">
        Missing {names.join(", ")}
      </Text>
    </>
  );
}

function LineKitSelect({
  orderId,
  line,
  kits,
  orderKitName,
}: {
  orderId: number;
  line: OrderLineView;
  kits: readonly PickerKit[];
  orderKitName: string;
}) {
  const { database } = useAppState();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const name = line.plan?.name ?? line.fallbackName;
  const selected =
    line.kitId !== null && !kits.some((kit) => kit.id === line.kitId)
      ? [...kits, { id: line.kitId, name: line.kitName || "Missing kit", archived: true }]
      : kits;
  const value = !line.kitOverride
    ? "default"
    : line.kitId === null
      ? undefined
      : String(line.kitId);

  async function save(kitId: number | null) {
    const unchanged = kitId === null ? !line.kitOverride : line.kitOverride && line.kitId === kitId;
    if (unchanged) {
      return;
    }
    setSaving(true);
    try {
      await setOrderLineKit(database.db, orderId, line.lineId, kitId);
      await router.invalidate();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not update the order.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Flex direction="column" gap="1" minWidth="14rem">
      <Text color="gray" size="1">
        Cooking kit
      </Text>
      <Select.Root
        value={value}
        disabled={saving}
        onValueChange={(next) => {
          void save(next === "default" ? null : Number(next));
        }}
      >
        <Select.Trigger aria-label={`Cooking kit for ${name}`} placeholder="Choose a kit" />
        <Select.Content>
          <Select.Item value="default">{`Default · ${orderKitName}`}</Select.Item>
          {selected.map((kit) => (
            <Select.Item key={kit.id} value={String(kit.id)}>
              {kit.archived ? `${kit.name} (archived)` : kit.name}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </Flex>
  );
}

function QuantityField({ orderId, line }: { orderId: number; line: OrderLineView }) {
  const { database } = useAppState();
  const router = useRouter();
  const [value, setValue] = useState(String(line.quantity));
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const message = orderPlanMessage(() => parseOrderQuantity(value));
    if (message) {
      setError(message);
      return;
    }
    const quantity = parseOrderQuantity(value);
    if (quantity === line.quantity) {
      setError(null);
      return;
    }
    setError(null);
    try {
      await setOrderLineQuantity(database.db, orderId, line.lineId, quantity);
      await router.invalidate();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not save the quantity.");
    }
  }

  return (
    <Flex direction="column" align="start" gap="1">
      <IntegerInput
        ariaLabel={`Quantity for ${line.plan?.name ?? line.fallbackName}`}
        value={value}
        width="5rem"
        onChange={setValue}
        onBlur={() => {
          void save();
        }}
      />
      {error ? (
        <Text color="red" size="1">
          {error}
        </Text>
      ) : null}
    </Flex>
  );
}

function SaleCell({
  orderId,
  line,
  editable,
  currencyLabel,
}: {
  orderId: number;
  line: OrderLineView;
  editable: boolean;
  currencyLabel: string;
}) {
  const plan = line.plan;
  if (!editable) {
    return (
      <Flex direction="column" align="start" gap="1">
        <Text>
          {plan?.unitSale === null || plan?.unitSale === undefined
            ? "Not set"
            : formatMoney(plan.unitSale, currencyLabel)}
        </Text>
        {plan?.saleSource ? <SaleSourceBadge source={plan.saleSource} /> : null}
        {plan && plan.unitSale !== null && plan.quantity > 1 ? (
          <Text color="gray" size="1">
            {formatMoney(plan.unitSale * plan.quantity, currencyLabel)} for {plan.quantity}
          </Text>
        ) : null}
      </Flex>
    );
  }
  return (
    <Flex direction="column" align="start" gap="1">
      <SaleField
        key={`${line.lineId}-${line.saleOverride ?? "follow"}`}
        currencyLabel={currencyLabel}
        line={line}
        orderId={orderId}
      />
      {plan?.saleSource ? <SaleSourceBadge source={plan.saleSource} /> : null}
      {plan ? (
        <Text color="gray" size="1">
          {suggestion(plan, currencyLabel)}
        </Text>
      ) : null}
      {plan && plan.unitSale !== null && plan.quantity > 1 ? (
        <Text color="gray" size="1">
          {formatMoney(plan.unitSale * plan.quantity, currencyLabel)} for {plan.quantity}
        </Text>
      ) : null}
    </Flex>
  );
}

function SaleField({
  orderId,
  line,
  currencyLabel,
}: {
  orderId: number;
  line: OrderLineView;
  currencyLabel: string;
}) {
  const { database } = useAppState();
  const router = useRouter();
  const [value, setValue] = useState(line.saleOverride === null ? "" : String(line.saleOverride));
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const message = orderPlanMessage(() => parseSaleOverride(value));
    if (message) {
      setError(message);
      return;
    }
    const saleOverride = parseSaleOverride(value);
    if (saleOverride === line.saleOverride) {
      setError(null);
      return;
    }
    setError(null);
    try {
      await setOrderLineSale(database.db, orderId, line.lineId, saleOverride);
      await router.invalidate();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not save the sale price.");
    }
  }

  return (
    <Flex direction="column" gap="1">
      <IntegerInput
        ariaLabel={`Sale price for ${line.plan?.name ?? line.fallbackName}`}
        placeholder={
          line.plan?.suggestedSale === null || line.plan?.suggestedSale === undefined
            ? "Sale price"
            : formatUnitValue(line.plan.suggestedSale, currencyLabel)
        }
        value={value}
        width="9rem"
        onChange={setValue}
        onBlur={() => {
          void save();
        }}
      />
      {error ? (
        <Text color="red" size="1">
          {error}
        </Text>
      ) : null}
    </Flex>
  );
}

function RemoveLine({ orderId, lineId }: { orderId: number; lineId: number }) {
  const { database } = useAppState();
  const router = useRouter();
  const [removing, setRemoving] = useState(false);

  return (
    <Button
      type="button"
      variant="soft"
      color="red"
      loading={removing}
      onClick={() => {
        void (async () => {
          setRemoving(true);
          try {
            await removeOrderLine(database.db, orderId, lineId);
            await router.invalidate();
          } catch (caught) {
            toast.error(caught instanceof Error ? caught.message : "Could not remove that line.");
          } finally {
            setRemoving(false);
          }
        })();
      }}
    >
      Remove
    </Button>
  );
}

function SaleSourceBadge({ source }: { source: OrderSaleSource }) {
  const color = source === "line" ? "green" : source === "recipe" ? "orange" : "gray";
  return (
    <Badge color={color} variant="soft">
      {saleSourceLabels[source]}
    </Badge>
  );
}

function suggestion(plan: PlanLine, currencyLabel: string): string {
  if (plan.suggestedSale === null || plan.suggestedSource === null) {
    return "Add inventory to suggest a sale. A number here still charges that amount.";
  }
  const from = plan.suggestedSource === "recipe" ? "the recipe override" : "the margin";
  return `Suggested ${formatMoney(plan.suggestedSale, currencyLabel)} from ${from}. Blank follows that.`;
}

function rateText(basisPoints: number | undefined): string {
  if (basisPoints === undefined) {
    return "—";
  }
  return formatSuccessRate(basisPoints);
}
