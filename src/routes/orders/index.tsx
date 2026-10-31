import { createFileRoute } from "@tanstack/react-router";
import { pageError } from "@/components/PageError";
import { pagePending } from "@/components/PagePending";
import { listOrderSummaries } from "@/db/orders";
import { openAppDatabase } from "@/db/open";
import { OrdersPage } from "@/pages/OrdersPage";

export const Route = createFileRoute("/orders/")({
  loader: async () => {
    const database = await openAppDatabase();
    const orders = await listOrderSummaries(database.db);
    return { orders };
  },
  component: OrdersPage,
  pendingComponent: pagePending("Loading orders…"),
  errorComponent: pageError("Could not load orders."),
});
