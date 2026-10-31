import { expect, test } from "vitest";
import { formatReceipt, formatShoppingList, type OrderDocument } from "./receipt";

function sampleOrder(patch: Partial<OrderDocument> = {}): OrderDocument {
  return {
    title: "Renan",
    notes: "",
    statusLabel: "Confirmed",
    planningModeLabel: "Conservative",
    priceBasisLabel: "Average",
    createdAt: "Oct 31, 2026, 10:47 AM",
    kitName: "Outdoor Cooking Kit",
    currencyLabel: "zeny",
    certainSuccess: false,
    lines: [
      { name: "Fried Grasshopper Legs", quantity: 2, unitSale: 120 },
      { name: "Steamed Tongue", quantity: 1, unitSale: null },
    ],
    materials: [
      { name: "Grasshopper's Leg", quantity: 6, kind: "ingredient" },
      { name: "Outdoor Cooking Kit", quantity: 8, kind: "kit" },
    ],
    statisticalFoodCost: 40,
    gatherCost: 48,
    roundingGap: 8,
    saleTotal: 240,
    profit: 192,
    ...patch,
  };
}

test("shopping list is the ceiled gather quantities", () => {
  expect(formatShoppingList(sampleOrder())).toBe(
    [
      "Shopping list — Renan",
      "Conservative · Average price · Outdoor Cooking Kit",
      "",
      "6 Grasshopper's Leg",
      "8 Outdoor Cooking Kit (total attempts)",
      "",
      "Gather cost: 48 zeny",
    ].join("\n"),
  );
});

test("shopping list explains a kit that always succeeds", () => {
  const text = formatShoppingList(
    sampleOrder({
      certainSuccess: true,
      materials: [],
      gatherCost: null,
    }),
  );
  expect(text).toContain("Nothing to gather yet.");
  expect(text).toContain("Gather cost: Missing prices");
  expect(text).toContain("The planning mode does not change the quantities.");
});

test("receipt lists the charge and the rounding gap", () => {
  expect(formatReceipt(sampleOrder({ notes: "Bring it Friday." }))).toBe(
    [
      "Kitchen RO",
      "Renan",
      "Confirmed · Conservative · Average price · Outdoor Cooking Kit",
      "Created Oct 31, 2026, 10:47 AM",
      "",
      "Notes: Bring it Friday.",
      "",
      "2× Fried Grasshopper Legs — 120 zeny each, 240 zeny",
      "1× Steamed Tongue — price not set",
      "",
      "Statistical food cost: 40 zeny",
      "Gather cost: 48 zeny",
      "Rounding gap: 8 zeny",
      "Sale total: 240 zeny",
      "Profit: 192 zeny",
    ].join("\n"),
  );
});
