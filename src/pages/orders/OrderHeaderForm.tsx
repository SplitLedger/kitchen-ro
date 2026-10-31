import { Button, Callout, Flex, Text, TextArea } from "@radix-ui/themes";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { FormField } from "@/components/FormField";
import { IntegerInput } from "@/components/IntegerInput";
import { TextFormControl } from "@/components/TextFormControl";
import { firstFieldError } from "@/components/firstFieldError";
import {
  parseCustomerName,
  parseOrderNotes,
  updateOrderHeader,
  type OrderHeaderDraft,
} from "@/db/orders";
import type { Order } from "@/db/schema";
import { cookProfileMessage, parseMastery, parseStat } from "@/domain/cooking/profile";
import {
  MARGIN_PERCENT_MAX,
  MARGIN_PERCENT_MIN,
  parseMarginPercent,
  pricingMessage,
} from "@/domain/pricing/cost";
import { useAppState } from "@/providers/AppStateProvider";

const statFields = [
  {
    name: "baseLevel",
    id: "order-base-level",
    label: "Base level",
    parse: (value: string) => parseStat(value, "Base level"),
  },
  {
    name: "dex",
    id: "order-dex",
    label: "DEX",
    parse: (value: string) => parseStat(value, "DEX"),
  },
  {
    name: "luk",
    id: "order-luk",
    label: "LUK",
    parse: (value: string) => parseStat(value, "LUK"),
  },
  {
    name: "mastery",
    id: "order-mastery",
    label: "Mastery",
    parse: (value: string) => parseMastery(value),
  },
] as const;

export function OrderHeaderForm({ order }: { order: Order }) {
  const { database } = useAppState();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      customerName: order.customerName,
      notes: order.notes,
      baseLevel: String(order.baseLevel),
      dex: String(order.dex),
      luk: String(order.luk),
      mastery: String(order.mastery),
      marginPercent: String(order.marginPercent),
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      setNotice(null);
      try {
        const customerName = parseCustomerName(value.customerName);
        const draft: OrderHeaderDraft = {
          customerName,
          notes: parseOrderNotes(value.notes),
          baseLevel: parseStat(value.baseLevel, "Base level"),
          dex: parseStat(value.dex, "DEX"),
          luk: parseStat(value.luk, "LUK"),
          mastery: parseMastery(value.mastery),
          marginPercent: parseMarginPercent(value.marginPercent),
        };
        await updateOrderHeader(database.db, order.id, draft);
        form.setFieldValue("customerName", customerName);
        form.setFieldValue("notes", draft.notes);
        form.setFieldValue("baseLevel", String(draft.baseLevel));
        form.setFieldValue("dex", String(draft.dex));
        form.setFieldValue("luk", String(draft.luk));
        form.setFieldValue("mastery", String(draft.mastery));
        form.setFieldValue("marginPercent", String(draft.marginPercent));
        await router.invalidate();
        setNotice("Saved.");
      } catch (caught) {
        setFormError(caught instanceof Error ? caught.message : "Could not save this order.");
      }
    },
  });

  return (
    <Flex asChild direction="column" gap="4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="customerName"
          validators={{
            onChange: ({ value }) => {
              try {
                parseCustomerName(value);
                return undefined;
              } catch (error) {
                return error instanceof Error ? error.message : "Customer name is too long.";
              }
            },
          }}
        >
          {(field) => (
            <TextFormControl
              id="order-customer"
              label="Customer"
              hint="Blank stays untitled on the order list."
              value={field.state.value}
              error={firstFieldError(field.state.meta.errors)}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
            />
          )}
        </form.Field>
        <form.Field
          name="notes"
          validators={{
            onChange: ({ value }) => {
              try {
                parseOrderNotes(value);
                return undefined;
              } catch (error) {
                return error instanceof Error ? error.message : "Notes are too long.";
              }
            },
          }}
        >
          {(field) => (
            <FormField
              id="order-notes"
              label="Notes"
              hint="Only for you. Notes are not part of the cost."
              error={firstFieldError(field.state.meta.errors)}
            >
              <TextArea
                id="order-notes"
                value={field.state.value}
                rows={3}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
              />
            </FormField>
          )}
        </form.Field>
        <Flex gap="3" wrap="wrap">
          {statFields.map((fieldDef) => (
            <form.Field
              key={fieldDef.name}
              name={fieldDef.name}
              validators={{
                onChange: ({ value }) => cookProfileMessage(() => fieldDef.parse(value)),
                onSubmit: ({ value }) => cookProfileMessage(() => fieldDef.parse(value)),
              }}
            >
              {(field) => (
                <FormField
                  id={fieldDef.id}
                  label={fieldDef.label}
                  error={firstFieldError(field.state.meta.errors)}
                >
                  <IntegerInput
                    id={fieldDef.id}
                    ariaLabel={fieldDef.label}
                    value={field.state.value}
                    width="8rem"
                    onBlur={field.handleBlur}
                    onChange={field.handleChange}
                  />
                </FormField>
              )}
            </form.Field>
          ))}
          <form.Field
            name="marginPercent"
            validators={{
              onChange: ({ value }) => pricingMessage(() => parseMarginPercent(value)),
              onSubmit: ({ value }) => pricingMessage(() => parseMarginPercent(value)),
            }}
          >
            {(field) => (
              <FormField
                id="order-margin"
                label="Margin"
                hint={`${MARGIN_PERCENT_MIN}–${MARGIN_PERCENT_MAX}. Copied from Settings, then kept on this order.`}
                error={firstFieldError(field.state.meta.errors)}
              >
                <IntegerInput
                  id="order-margin"
                  ariaLabel="Margin percent"
                  value={field.state.value}
                  width="8rem"
                  onBlur={field.handleBlur}
                  onChange={field.handleChange}
                />
              </FormField>
            )}
          </form.Field>
        </Flex>
        {notice ? <Text color="green">{notice}</Text> : null}
        {formError ? (
          <Callout.Root color="red" variant="surface">
            <Callout.Text>{formError}</Callout.Text>
          </Callout.Root>
        ) : null}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Flex>
              <Button type="submit" loading={isSubmitting}>
                Save order
              </Button>
            </Flex>
          )}
        </form.Subscribe>
      </form>
    </Flex>
  );
}
