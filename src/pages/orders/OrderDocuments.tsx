import { Button, Flex, Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import type { OrderLineView } from "@/db/orders";
import type { Order } from "@/db/schema";
import type { OrderPlan } from "@/domain/orders/plan";
import { formatReceipt, formatShoppingList } from "@/domain/orders/receipt";
import { copyPlainText } from "@/pages/orders/copyText";
import { toOrderDocument } from "@/pages/orders/document";
import { useAppState } from "@/providers/AppStateProvider";

export function OrderDocuments({
  order,
  lines,
  plan,
}: {
  order: Order;
  lines: readonly OrderLineView[];
  plan: OrderPlan;
}) {
  const { settings } = useAppState();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const orderDocument = toOrderDocument(order, lines, plan, settings.currencyLabel);

  useEffect(() => {
    if (!fallback) {
      return;
    }
    const node = window.document.querySelector<HTMLTextAreaElement>("[data-order-copy]");
    node?.focus();
    node?.select();
  }, [fallback]);

  async function copy(kind: "list" | "receipt") {
    setError(null);
    const text = kind === "list" ? formatShoppingList(orderDocument) : formatReceipt(orderDocument);
    try {
      await copyPlainText(text);
      setFallback(null);
      setNotice(kind === "list" ? "Copied the shopping list." : "Copied the receipt.");
    } catch (caught) {
      setNotice(null);
      setFallback(text);
      setError(
        caught instanceof Error
          ? `${caught.message} The text is selected below.`
          : "Could not copy that text. It is selected below.",
      );
    }
  }

  return (
    <Flex className="no-print" direction="column" gap="2">
      <Flex gap="3" wrap="wrap">
        <Button
          type="button"
          variant="soft"
          onClick={() => {
            void copy("list");
          }}
        >
          Copy shopping list
        </Button>
        <Button
          type="button"
          variant="soft"
          onClick={() => {
            void copy("receipt");
          }}
        >
          Copy receipt
        </Button>
        <Button
          type="button"
          variant="soft"
          onClick={() => {
            window.print();
          }}
        >
          Print
        </Button>
      </Flex>
      {notice ? (
        <Text color="green" size="2">
          {notice}
        </Text>
      ) : null}
      {error ? (
        <Text color="red" size="2">
          {error}
        </Text>
      ) : null}
      {fallback ? (
        <textarea
          readOnly
          data-order-copy=""
          aria-label="Text to copy"
          value={fallback}
          rows={Math.min(16, fallback.split("\n").length + 1)}
          style={{ width: "100%", fontFamily: "inherit" }}
        />
      ) : null}
    </Flex>
  );
}
