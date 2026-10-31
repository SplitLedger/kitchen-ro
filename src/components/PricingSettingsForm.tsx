import { Button, Flex } from "@radix-ui/themes";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { FormField } from "@/components/FormField";
import { IntegerInput } from "@/components/IntegerInput";
import { TextFormControl } from "@/components/TextFormControl";
import { firstFieldError } from "@/components/firstFieldError";
import type { Settings } from "@/db/schema";
import {
  MARGIN_PERCENT_MAX,
  MARGIN_PERCENT_MIN,
  parseCurrencyLabel,
  parseMarginPercent,
  pricingMessage,
  type PricingSettingsDraft,
} from "@/domain/pricing/cost";

export function PricingSettingsForm({
  settings,
  onSave,
}: {
  settings: Settings;
  onSave: (draft: PricingSettingsDraft) => Promise<void>;
}) {
  const form = useForm({
    defaultValues: {
      marginPercent: String(settings.marginPercent),
      currencyLabel: settings.currencyLabel,
    },
    onSubmit: async ({ value }) => {
      try {
        const marginPercent = parseMarginPercent(value.marginPercent);
        const currencyLabel = parseCurrencyLabel(value.currencyLabel);
        await onSave({ marginPercent, currencyLabel });
        form.setFieldValue("marginPercent", String(marginPercent));
        form.setFieldValue("currencyLabel", currencyLabel);
        toast.success("Saved the margin and currency.");
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "Could not save pricing.");
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
          name="marginPercent"
          validators={{
            onChange: ({ value }) => pricingMessage(() => parseMarginPercent(value)),
            onSubmit: ({ value }) => pricingMessage(() => parseMarginPercent(value)),
          }}
        >
          {(field) => (
            <FormField
              id="margin-percent"
              label="Margin"
              hint={`${MARGIN_PERCENT_MIN}–${MARGIN_PERCENT_MAX}. 20 adds 20% to the cost of one success, then rounds up.`}
              error={firstFieldError(field.state.meta.errors)}
            >
              <IntegerInput
                id="margin-percent"
                ariaLabel="Margin percent"
                value={field.state.value}
                width="8rem"
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            </FormField>
          )}
        </form.Field>
        <form.Field
          name="currencyLabel"
          validators={{
            onChange: ({ value }) => pricingMessage(() => parseCurrencyLabel(value)),
            onSubmit: ({ value }) => pricingMessage(() => parseCurrencyLabel(value)),
          }}
        >
          {(field) => (
            <TextFormControl
              id="currency-label"
              label="Currency label"
              hint="Shown after amounts. The default is zeny."
              value={field.state.value}
              error={firstFieldError(field.state.meta.errors)}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
            />
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Flex>
              <Button type="submit" loading={isSubmitting}>
                Save margin and currency
              </Button>
            </Flex>
          )}
        </form.Subscribe>
      </form>
    </Flex>
  );
}
