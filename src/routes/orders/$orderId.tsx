import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageError } from "@/components/PageError";
import { pagePending } from "@/components/PagePending";
import { getOrderDetail } from "@/db/orders";
import { openAppDatabase } from "@/db/open";
import { OrderMissing } from "@/pages/orders/OrderMissing";
import { OrderPage } from "@/pages/orders/OrderPage";

export const Route = createFileRoute("/orders/$orderId")({
  loader: async ({ params }) => {
    const orderId = Number(params.orderId);
    if (!Number.isInteger(orderId) || orderId < 1) {
      throw notFound();
    }
    const database = await openAppDatabase();
    const detail = await getOrderDetail(database.db, orderId);
    if (!detail) {
      throw notFound();
    }
    return { detail };
  },
  component: OrderPage,
  pendingComponent: pagePending("Loading the order…"),
  errorComponent: pageError("Could not load this order."),
  notFoundComponent: OrderMissing,
});
