import { Button, Flex, RadioGroup, Text, TextField } from "@radix-ui/themes";
import { useState, type FormEvent, type ReactNode } from "react";
import { FormField } from "@/components/FormField";
import { IntegerInput } from "@/components/IntegerInput";
import {
  lotMessage,
  parseLotNote,
  parseLotQuantity,
  parseLotSource,
  parseLotUnitPrice,
} from "@/domain/inventory/lot";
import type { LotSource } from "@/domain/inventory/prices";

export type LotFormValues = {
  quantity: string;
  unitPrice: string;
  source: LotSource;
  note: string;
};

export function emptyLotForm(): LotFormValues {
  return {
    quantity: "1",
    unitPrice: "",
    source: "bought",
    note: "",
  };
}

export function LotForm({
  idPrefix,
  currencyLabel,
  referencePrice,
  initial,
  quantityMode,
  submitLabel,
  disabled,
  leading,
  onSubmit,
  onCancel,
}: {
  idPrefix: string;
  currencyLabel: string;
  referencePrice: number | null;
  initial: LotFormValues;
  quantityMode: "create" | "edit";
  submitLabel: string;
  disabled: boolean;
  leading?: ReactNode;
  onSubmit: (values: {
    quantity: number;
    unitPrice: number;
    source: LotSource;
    note: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function patch(partial: Partial<LotFormValues>) {
    setValues((current) => ({ ...current, ...partial }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const quantityError = lotMessage(() => parseLotQuantity(values.quantity, quantityMode));
    const priceError = lotMessage(() => parseLotUnitPrice(values.unitPrice));
    const noteError = lotMessage(() => parseLotNote(values.note));
    const message = quantityError ?? priceError ?? noteError;
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    try {
      await onSubmit({
        quantity: parseLotQuantity(values.quantity, quantityMode),
        unitPrice: parseLotUnitPrice(values.unitPrice),
        source: parseLotSource(values.source),
        note: parseLotNote(values.note),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the lot.");
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <Flex direction="column" gap="3">
        {leading}
        <Flex gap="3" wrap="wrap">
          <FormField id={`${idPrefix}-quantity`} label="Quantity">
            <IntegerInput
              id={`${idPrefix}-quantity`}
              ariaLabel="Quantity"
              value={values.quantity}
              disabled={disabled}
              width="8rem"
              onChange={(quantity) => patch({ quantity })}
            />
          </FormField>
          <FormField id={`${idPrefix}-price`} label={`Unit price (${currencyLabel})`}>
            <IntegerInput
              id={`${idPrefix}-price`}
              ariaLabel="Unit price"
              value={values.unitPrice}
              disabled={disabled}
              width="8rem"
              placeholder="0"
              onChange={(unitPrice) => patch({ unitPrice })}
            />
          </FormField>
        </Flex>
        <Flex direction="column" gap="2">
          <Text size="2" weight="medium">
            Source
          </Text>
          <RadioGroup.Root
            value={values.source}
            disabled={disabled}
            onValueChange={(source) => {
              if (source === "bought" || source === "farmed") {
                patch({ source });
              }
            }}
          >
            <Flex gap="4">
              <Flex align="center" gap="2">
                <RadioGroup.Item value="bought" id={`${idPrefix}-bought`} />
                <Text as="label" htmlFor={`${idPrefix}-bought`} size="2">
                  Bought
                </Text>
              </Flex>
              <Flex align="center" gap="2">
                <RadioGroup.Item value="farmed" id={`${idPrefix}-farmed`} />
                <Text as="label" htmlFor={`${idPrefix}-farmed`} size="2">
                  Farmed
                </Text>
              </Flex>
            </Flex>
          </RadioGroup.Root>
          <Text color="gray" size="1">
            Bought and farmed are labels. They do not change the price.
          </Text>
        </Flex>
        <FormField id={`${idPrefix}-note`} label="Note" hint="Optional.">
          <TextField.Root
            id={`${idPrefix}-note`}
            aria-label="Note"
            value={values.note}
            disabled={disabled}
            onChange={(event) => patch({ note: event.target.value })}
          />
        </FormField>
        {error ? (
          <Text color="red" size="2">
            {error}
          </Text>
        ) : null}
        <Flex gap="3" wrap="wrap">
          {referencePrice !== null ? (
            <Button
              type="button"
              variant="soft"
              color="gray"
              disabled={disabled}
              onClick={() => patch({ unitPrice: String(referencePrice) })}
            >
              Use NPC price ({referencePrice} {currencyLabel})
            </Button>
          ) : null}
          <Button type="submit" loading={disabled}>
            {submitLabel}
          </Button>
          <Button type="button" variant="soft" color="gray" disabled={disabled} onClick={onCancel}>
            Cancel
          </Button>
        </Flex>
      </Flex>
    </form>
  );
}
