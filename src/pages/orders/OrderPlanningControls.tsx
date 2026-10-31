import { Badge, Callout, Flex, RadioGroup, Select, Text } from "@radix-ui/themes";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  updateOrderKit,
  updateOrderPlanningMode,
  updateOrderPriceBasis,
  type PickerKit,
} from "@/db/orders";
import type { Order } from "@/db/schema";
import { isPriceBasis, priceBasisLabels } from "@/domain/inventory/prices";
import { isOrderPlanningMode, type OrderPlanningMode } from "@/domain/orders/plan";
import { useAppState } from "@/providers/AppStateProvider";

export function OrderPlanningControls({
  order,
  kits,
  certainSuccess,
}: {
  order: Order;
  kits: readonly PickerKit[];
  certainSuccess: boolean;
}) {
  const { database } = useAppState();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const options =
    order.kitId && !kits.some((kit) => kit.id === order.kitId)
      ? [...kits, { id: order.kitId, name: order.kitName || "Missing kit", archived: true }]
      : kits;

  async function save(change: () => Promise<void>) {
    setSaving(true);
    try {
      await change();
      await router.invalidate();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not update the order.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Flex direction="column" gap="3">
      <Flex gap="5" wrap="wrap">
        <Flex direction="column" gap="2">
          <Text size="2" weight="medium">
            Planning mode
          </Text>
          <RadioGroup.Root
            value={order.planningMode}
            disabled={saving}
            onValueChange={(value) => {
              if (!isOrderPlanningMode(value) || value === order.planningMode) {
                return;
              }
              const mode: OrderPlanningMode = value;
              void save(() => updateOrderPlanningMode(database.db, order.id, mode));
            }}
          >
            <Flex direction="column" gap="2">
              <Flex align="center" gap="2">
                <RadioGroup.Item value="expected" id={`order-${order.id}-expected`} />
                <Text as="label" htmlFor={`order-${order.id}-expected`} size="2">
                  Expected — average success
                </Text>
              </Flex>
              <Flex align="center" gap="2">
                <RadioGroup.Item value="conservative" id={`order-${order.id}-conservative`} />
                <Text as="label" htmlFor={`order-${order.id}-conservative`} size="2">
                  Conservative — minimum success
                </Text>
              </Flex>
            </Flex>
          </RadioGroup.Root>
        </Flex>
        <Flex direction="column" gap="2">
          <Text size="2" weight="medium">
            Price basis
          </Text>
          <RadioGroup.Root
            value={order.priceBasis}
            disabled={saving}
            onValueChange={(value) => {
              if (!isPriceBasis(value) || value === order.priceBasis) {
                return;
              }
              void save(() => updateOrderPriceBasis(database.db, order.id, value));
            }}
          >
            <Flex direction="column" gap="2">
              <Flex align="center" gap="2">
                <RadioGroup.Item value="minimum" id={`order-${order.id}-price-minimum`} />
                <Text as="label" htmlFor={`order-${order.id}-price-minimum`} size="2">
                  {priceBasisLabels.minimum}
                </Text>
              </Flex>
              <Flex align="center" gap="2">
                <RadioGroup.Item value="average" id={`order-${order.id}-price-average`} />
                <Text as="label" htmlFor={`order-${order.id}-price-average`} size="2">
                  {priceBasisLabels.average}
                </Text>
              </Flex>
              <Flex align="center" gap="2">
                <RadioGroup.Item value="maximum" id={`order-${order.id}-price-maximum`} />
                <Text as="label" htmlFor={`order-${order.id}-price-maximum`} size="2">
                  {priceBasisLabels.maximum}
                </Text>
              </Flex>
            </Flex>
          </RadioGroup.Root>
        </Flex>
        <Flex direction="column" gap="2" minWidth="16rem">
          <Text size="2" weight="medium">
            Default cooking kit
          </Text>
          {options.length > 0 ? (
            <Select.Root
              value={order.kitId ? String(order.kitId) : undefined}
              disabled={saving}
              onValueChange={(value) => {
                const kitId = Number(value);
                if (kitId === order.kitId) {
                  return;
                }
                void save(() => updateOrderKit(database.db, order.id, kitId));
              }}
            >
              <Select.Trigger aria-label="Default cooking kit" placeholder="Choose a kit" />
              <Select.Content>
                {options.map((kit) => (
                  <Select.Item key={kit.id} value={String(kit.id)}>
                    {kit.archived ? `${kit.name} (archived)` : kit.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          ) : (
            <Text color="gray" size="2">
              Unarchive a cooking kit before choosing one.
            </Text>
          )}
        </Flex>
      </Flex>
      {certainSuccess ? (
        <Callout.Root color="green" variant="surface">
          <Callout.Text>
            This kit always succeeds, so Expected and Conservative both use 100%. The shopping list
            asks for one attempt per food, and the mode does not change the quantities.
          </Callout.Text>
        </Callout.Root>
      ) : null}
      {order.kitId && kits.some((kit) => kit.id === order.kitId && kit.archived) ? (
        <Badge color="gray" variant="soft">
          The kit on this order is archived.
        </Badge>
      ) : null}
    </Flex>
  );
}
