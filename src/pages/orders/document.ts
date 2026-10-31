import type { OrderLineView } from "@/db/orders";
import type { Order } from "@/db/schema";
import type { OrderDocument } from "@/domain/orders/receipt";
import { priceBasisLabels } from "@/domain/inventory/prices";
import { planningModeLabels, type OrderPlan } from "@/domain/orders/plan";
import { formatOrderTime, orderStatusLabels, orderTitle } from "@/pages/orders/format";

export function toOrderDocument(
  order: Order,
  lines: readonly OrderLineView[],
  plan: OrderPlan,
  currencyLabel: string,
): OrderDocument {
  return {
    title: orderTitle(order.customerName),
    notes: order.notes,
    statusLabel: orderStatusLabels[order.status],
    planningModeLabel: planningModeLabels[order.planningMode],
    priceBasisLabel: priceBasisLabels[order.priceBasis],
    createdAt: formatOrderTime(order.createdAt),
    kitName: order.kitName,
    currencyLabel,
    certainSuccess: plan.certainSuccess,
    lines: lines.map((line) => ({
      name: line.plan?.name ?? line.fallbackName,
      quantity: line.plan?.quantity ?? line.quantity,
      unitSale: line.plan?.unitSale ?? null,
    })),
    materials: plan.materials.map((material) => ({
      name: material.name,
      quantity: material.quantity,
      kind: material.kind,
      onHand: material.onHand,
      shortfall: material.shortfall,
    })),
    statisticalFoodCost: plan.statisticalFoodCost,
    gatherCost: plan.gatherCost,
    roundingGap: plan.roundingGap,
    saleTotal: plan.saleTotal,
    profit: plan.profit,
  };
}
