import { DateTime } from "luxon";
import type { OrderStatus } from "@/db/schema";

export const orderStatusLabels: Record<OrderStatus, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  done: "Done",
  cancelled: "Cancelled",
};

export function orderStatusColor(status: OrderStatus): "gray" | "green" | "blue" | "red" {
  if (status === "confirmed") {
    return "green";
  }
  if (status === "done") {
    return "blue";
  }
  if (status === "cancelled") {
    return "red";
  }
  return "gray";
}

export function formatOrderTime(iso: string): string {
  const parsed = DateTime.fromISO(iso);
  if (!parsed.isValid) {
    return iso;
  }
  return parsed.toLocaleString(DateTime.DATETIME_MED);
}

export function orderTitle(customerName: string): string {
  const name = customerName.trim();
  return name ? name : "Untitled order";
}
