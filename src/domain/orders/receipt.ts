export type OrderDocumentLine = {
  name: string;
  quantity: number;
  unitSale: number | null;
};

export type OrderDocumentMaterial = {
  name: string;
  quantity: number;
  kind: "ingredient" | "kit";
  onHand?: number;
  shortfall?: number;
};

export type OrderDocument = {
  title: string;
  notes: string;
  statusLabel: string;
  planningModeLabel: string;
  priceBasisLabel: string;
  createdAt: string;
  kitName: string;
  currencyLabel: string;
  certainSuccess: boolean;
  lines: readonly OrderDocumentLine[];
  materials: readonly OrderDocumentMaterial[];
  statisticalFoodCost: number | null;
  gatherCost: number | null;
  roundingGap: number | null;
  saleTotal: number | null;
  profit: number | null;
};

export function formatShoppingList(order: OrderDocument): string {
  const lines = [
    `Shopping list — ${order.title}`,
    `${order.planningModeLabel} · ${order.priceBasisLabel} price · ${order.kitName}`,
    "",
  ];
  if (order.materials.length === 0) {
    lines.push("Nothing to gather yet.");
  } else {
    for (const material of order.materials) {
      lines.push(materialLine(material));
    }
  }
  lines.push("", `Gather cost: ${money(order.gatherCost, order.currencyLabel)}`);
  if (order.certainSuccess) {
    lines.push(
      "This kit always succeeds, so the list asks for one attempt per food. The planning mode does not change the quantities.",
    );
  }
  return lines.join("\n");
}

export function formatReceipt(order: OrderDocument): string {
  const lines = [
    "Kitchen RO",
    order.title,
    `${order.statusLabel} · ${order.planningModeLabel} · ${order.priceBasisLabel} price · ${order.kitName}`,
    `Created ${order.createdAt}`,
  ];
  const notes = order.notes.trim();
  if (notes) {
    lines.push("", `Notes: ${notes}`);
  }
  lines.push("");
  if (order.lines.length === 0) {
    lines.push("No dishes on this order.");
  } else {
    for (const line of order.lines) {
      lines.push(`${line.quantity}× ${line.name} — ${saleText(line, order.currencyLabel)}`);
    }
  }
  lines.push(
    "",
    `Statistical food cost: ${money(order.statisticalFoodCost, order.currencyLabel)}`,
    `Gather cost: ${money(order.gatherCost, order.currencyLabel)}`,
    `Rounding gap: ${money(order.roundingGap, order.currencyLabel)}`,
    `Sale total: ${money(order.saleTotal, order.currencyLabel)}`,
    `Profit: ${money(order.profit, order.currencyLabel)}`,
  );
  return lines.join("\n");
}

function materialLine(material: OrderDocumentMaterial): string {
  const attempts = material.kind === "kit" ? " (total attempts)" : "";
  const stock =
    material.onHand === undefined
      ? ""
      : ` — on hand ${material.onHand}, short ${material.shortfall ?? 0}`;
  return `${material.quantity} ${material.name}${attempts}${stock}`;
}

function saleText(line: OrderDocumentLine, currencyLabel: string): string {
  if (line.unitSale === null) {
    return "price not set";
  }
  const each = formatAmount(line.unitSale, currencyLabel);
  if (line.quantity === 1) {
    return each;
  }
  const extended = line.unitSale * line.quantity;
  if (!Number.isSafeInteger(extended)) {
    return `${each} each`;
  }
  return `${each} each, ${formatAmount(extended, currencyLabel)}`;
}

function formatAmount(amount: number, currencyLabel: string): string {
  return `${amount} ${currencyLabel}`;
}

function money(amount: number | null, currencyLabel: string): string {
  if (amount === null) {
    return "Missing prices";
  }
  return formatAmount(amount, currencyLabel);
}
