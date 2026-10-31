import {
  Badge,
  Callout,
  Card,
  Flex,
  Grid,
  Heading,
  Link as ThemeLink,
  Text,
} from "@radix-ui/themes";
import { Link, getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/ConfirmAction";
import {
  cancelOrder,
  confirmOrder,
  deleteDraftOrder,
  markOrderDone,
  reopenOrder,
} from "@/db/orders";
import type { Order } from "@/db/schema";
import { planningModeLabels } from "@/domain/orders/plan";
import { priceBasisLabels } from "@/domain/inventory/prices";
import { Fact } from "@/pages/catalog/$recipeId/Fact";
import {
  formatOrderTime,
  orderStatusColor,
  orderStatusLabels,
  orderTitle,
} from "@/pages/orders/format";
import { OrderDocuments } from "@/pages/orders/OrderDocuments";
import { OrderHeaderForm } from "@/pages/orders/OrderHeaderForm";
import { OrderLines } from "@/pages/orders/OrderLines";
import { OrderPlanningControls } from "@/pages/orders/OrderPlanningControls";
import { ShoppingList } from "@/pages/orders/ShoppingList";
import { useAppState } from "@/providers/AppStateProvider";

const routeApi = getRouteApi("/orders/$orderId");

export function OrderPage() {
  const { detail } = routeApi.useLoaderData();
  const { database, settings } = useAppState();
  const router = useRouter();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const { order, plan } = detail;
  const editable = order.status === "draft";
  const blocked = plan.blockers.length > 0;

  async function confirm() {
    setSaving(true);
    try {
      await confirmOrder(database.db, order.id);
      await router.invalidate();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not confirm this order.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await deleteDraftOrder(database.db, order.id);
      await router.invalidate();
      await navigate({ to: "/orders" });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not delete this order.");
      setSaving(false);
    }
  }

  async function changeStatus(action: () => Promise<void>, fallback: string) {
    setSaving(true);
    try {
      await action();
      await router.invalidate();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : fallback);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Flex direction="column" gap="5">
      <Text className="print-only" size="2" weight="bold">
        Kitchen RO
      </Text>
      <ThemeLink asChild className="no-print">
        <Link to="/orders">Back to orders</Link>
      </ThemeLink>
      <Flex direction="column" gap="2">
        <Flex align="center" gap="2" wrap="wrap">
          <Heading as="h1" size="6">
            {orderTitle(order.customerName)}
          </Heading>
          <Badge color={orderStatusColor(order.status)} variant="soft">
            {orderStatusLabels[order.status]}
          </Badge>
          <Badge color="gray" variant="soft">
            {planningModeLabels[order.planningMode]}
          </Badge>
          <Badge color="gray" variant="soft">
            {priceBasisLabels[order.priceBasis]} price
          </Badge>
        </Flex>
        <Text color="gray" size="2">
          Created {formatOrderTime(order.createdAt)} · Updated {formatOrderTime(order.updatedAt)}
        </Text>
      </Flex>
      <StatusCallout order={order} />
      {editable ? (
        <Grid columns={{ initial: "1", lg: "2" }} gap="5">
          <OrderCard
            title="Planning"
            description="Expected uses the average success rate. Conservative uses the minimum. The price basis picks one unit price from lots still on hand. Choosing one saves it."
          >
            <OrderPlanningControls
              certainSuccess={plan.certainSuccess}
              kits={detail.pickerKits}
              order={order}
            />
          </OrderCard>
          <OrderCard
            title="Customer and cook"
            description="The customer name is optional. Cook stats and margin are stored on this order. Saving them updates the rates. Settings changes do not rewrite this draft."
          >
            <OrderHeaderForm key={order.id} order={order} />
          </OrderCard>
        </Grid>
      ) : (
        <OrderCard
          title="This order"
          description="Kit, cook stats, margin, and price basis stay as they were when this plan was calculated."
        >
          <Flex direction="column" gap="4">
            <Flex gap="5" wrap="wrap">
              <Fact label="Default cooking kit" value={order.kitName} />
              <Fact label="Base level" value={String(order.baseLevel)} />
              <Fact label="DEX" value={String(order.dex)} />
              <Fact label="LUK" value={String(order.luk)} />
              <Fact label="Mastery" value={String(order.mastery)} />
              <Fact label="Margin" value={`${order.marginPercent}%`} />
              <Fact label="Price basis" value={priceBasisLabels[order.priceBasis]} />
              <Fact label="Currency" value={settings.currencyLabel} />
            </Flex>
            {order.notes ? <Text>{order.notes}</Text> : null}
          </Flex>
        </OrderCard>
      )}
      <OrderCard
        title="Foods"
        description={
          editable
            ? "Choose a dish from its level. A dish already on the order gets one more. The cost of one success uses the rate for the planning mode."
            : "The cost of one success uses the rate for the planning mode."
        }
      >
        <OrderLines
          editable={editable}
          kits={detail.pickerKits}
          lines={detail.lines}
          orderId={order.id}
          orderKitName={order.kitName}
          recipes={detail.pickerRecipes}
        />
      </OrderCard>
      <OrderCard
        title="Shopping list"
        description="The charge for each food is one attempt divided by the success rate, rounded up. The list rounds each dish's attempts up first, then adds ingredients and kits. You are charged for the full cook, not only the shortfall. Profit is the sale total minus what the list costs to buy."
      >
        <ShoppingList plan={plan} />
      </OrderCard>
      <OrderCard
        className="no-print"
        title="Copy and print"
        description="Copy the shopping list or the receipt, or print this order."
      >
        <OrderDocuments lines={detail.lines} order={order} plan={plan} />
      </OrderCard>
      {editable && blocked ? (
        <Callout.Root color="orange" variant="surface">
          <Flex direction="column" gap="1">
            {plan.blockers.map((blocker) => (
              <Text key={blocker} size="2">
                {blocker}
              </Text>
            ))}
            {plan.blockers.length > 0 ? (
              <ThemeLink asChild>
                <Link to="/inventory">Edit inventory</Link>
              </ThemeLink>
            ) : null}
          </Flex>
        </Callout.Root>
      ) : null}
      {editable ? (
        <Flex className="no-print" gap="3" wrap="wrap">
          <ConfirmAction
            actionLabel="Confirm order"
            loading={saving}
            color="gray"
            description="This freezes the rates, costs, and shopping list, and takes those quantities out of inventory. Later lots do not change this order."
            disabled={blocked || saving}
            title="Confirm this order?"
            triggerLabel="Confirm order"
            onConfirm={() => {
              void confirm();
            }}
          />
          <ConfirmAction
            actionLabel="Delete draft"
            description="This draft and its lines are removed."
            disabled={saving}
            loading={saving}
            title="Delete this draft?"
            triggerLabel="Delete draft"
            onConfirm={() => {
              void remove();
            }}
          />
        </Flex>
      ) : (
        <Flex className="no-print" gap="3" wrap="wrap">
          {order.status === "confirmed" ? (
            <>
              <ConfirmAction
                actionLabel="Mark done"
                color="gray"
                description="The frozen plan stays. Inventory was already taken when the order was confirmed."
                disabled={saving}
                loading={saving}
                title="Mark this order done?"
                triggerLabel="Mark done"
                onConfirm={() => {
                  void changeStatus(
                    () => markOrderDone(database.db, order.id),
                    "Could not mark this order done.",
                  );
                }}
              />
              <ConfirmAction
                actionLabel="Cancel order"
                description="The frozen plan stays. The quantities this order took go back into inventory."
                disabled={saving}
                loading={saving}
                title="Cancel this order?"
                triggerLabel="Cancel order"
                onConfirm={() => {
                  void changeStatus(
                    () => cancelOrder(database.db, order.id),
                    "Could not cancel this order.",
                  );
                }}
              />
            </>
          ) : null}
          <ConfirmAction
            actionLabel="Reopen and recalculate"
            color="gray"
            description="The frozen rates, costs, and shopping list are discarded. Stock this order still holds goes back into inventory. The order is then recalculated from the current catalog and lots. Quantities and sale overrides stay."
            disabled={saving}
            loading={saving}
            title="Reopen this order as a draft?"
            triggerLabel="Reopen as draft"
            onConfirm={() => {
              void changeStatus(
                () => reopenOrder(database.db, order.id),
                "Could not reopen this order.",
              );
            }}
          />
        </Flex>
      )}
    </Flex>
  );
}

function OrderCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className} size="2" variant="surface">
      <Flex direction="column" gap="4">
        <Flex direction="column" gap="2">
          <Heading as="h2" size="4">
            {title}
          </Heading>
          <Text as="p" color="gray">
            {description}
          </Text>
        </Flex>
        {children}
      </Flex>
    </Card>
  );
}

function StatusCallout({ order }: { order: Order }) {
  if (order.status === "confirmed" && order.confirmedAt) {
    return (
      <Callout.Root color="green" variant="surface">
        <Callout.Text>
          Confirmed {formatOrderTime(order.confirmedAt)}. Rates, costs, and the shopping list are
          frozen. Inventory for this cook was taken from the lots. Reopen the order to put that
          stock back and recalculate.
        </Callout.Text>
      </Callout.Root>
    );
  }
  if (order.status === "done") {
    return (
      <Callout.Root color="blue" variant="surface">
        <Callout.Text>
          Marked done {formatOrderTime(order.updatedAt)}. The frozen plan is unchanged. Reopen it as
          a draft to recalculate, which discards this snapshot.
        </Callout.Text>
      </Callout.Root>
    );
  }
  if (order.status === "cancelled") {
    return (
      <Callout.Root color="red" variant="surface">
        <Callout.Text>
          Cancelled {formatOrderTime(order.updatedAt)}. The frozen plan is unchanged. Reopen it as a
          draft to change the order, which discards this snapshot.
        </Callout.Text>
      </Callout.Root>
    );
  }
  return null;
}
