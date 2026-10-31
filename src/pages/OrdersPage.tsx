import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  Link as ThemeLink,
  Table,
  Text,
} from "@radix-ui/themes";
import { Link, getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { formatMoney } from "@/components/formatReferencePrice";
import { createDraftOrder, type OrderSummary } from "@/db/orders";
import { planningModeLabels } from "@/domain/orders/plan";
import {
  formatOrderTime,
  orderStatusColor,
  orderStatusLabels,
  orderTitle,
} from "@/pages/orders/format";
import { useAppState } from "@/providers/AppStateProvider";

const routeApi = getRouteApi("/orders/");

export function OrdersPage() {
  const { orders } = routeApi.useLoaderData();
  const { database, settings } = useAppState();
  const router = useRouter();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  async function create() {
    setCreating(true);
    try {
      const orderId = await createDraftOrder(database.db, settings);
      await router.invalidate();
      await navigate({ to: "/orders/$orderId", params: { orderId: String(orderId) } });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not start an order.");
      setCreating(false);
    }
  }

  return (
    <Flex direction="column" gap="5">
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Flex direction="column" gap="2">
          <Heading as="h1" size="6">
            Orders
          </Heading>
          <Text as="p" color="gray">
            A draft tells you what to gather and what to charge. Confirming freezes that plan.
          </Text>
        </Flex>
        <Button
          loading={creating}
          onClick={() => {
            void create();
          }}
        >
          New order
        </Button>
      </Flex>
      {orders.length === 0 ? (
        <Text color="gray">No orders yet.</Text>
      ) : (
        <Box style={{ overflowX: "auto" }}>
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Customer</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Mode</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">Dishes</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">Sale</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Created</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {orders.map((order) => (
                <OrderRow key={order.id} currencyLabel={settings.currencyLabel} order={order} />
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
      )}
    </Flex>
  );
}

function OrderRow({ order, currencyLabel }: { order: OrderSummary; currencyLabel: string }) {
  return (
    <Table.Row>
      <Table.Cell>
        <ThemeLink asChild>
          <Link params={{ orderId: String(order.id) }} to="/orders/$orderId">
            {orderTitle(order.customerName)}
          </Link>
        </ThemeLink>
      </Table.Cell>
      <Table.Cell>
        <Badge color={orderStatusColor(order.status)} variant="soft">
          {orderStatusLabels[order.status]}
        </Badge>
      </Table.Cell>
      <Table.Cell>{planningModeLabels[order.planningMode]}</Table.Cell>
      <Table.Cell justify="end">{order.lineCount}</Table.Cell>
      <Table.Cell justify="end">{saleLabel(order, currencyLabel)}</Table.Cell>
      <Table.Cell>{formatOrderTime(order.createdAt)}</Table.Cell>
    </Table.Row>
  );
}

function saleLabel(order: OrderSummary, currencyLabel: string): string {
  if (order.lineCount === 0) {
    return "—";
  }
  if (order.saleTotal === null) {
    return "Missing prices";
  }
  return formatMoney(order.saleTotal, currencyLabel);
}
