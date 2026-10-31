import { Button, Callout, Flex, Text } from "@radix-ui/themes";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { FormField } from "@/components/FormField";
import { IntegerInput } from "@/components/IntegerInput";
import { firstFieldError } from "@/components/firstFieldError";
import { setRecipeSaleOverride } from "@/db/catalog-edit";
import { invalidMessage, parseOptionalInt } from "@/domain/catalog/edit";
import { useAppState } from "@/providers/AppStateProvider";

export function SaleOverrideForm({
  recipeId,
  salePriceOverride,
  currencyLabel,
}: {
  recipeId: number;
  salePriceOverride: number | null;
  currencyLabel: string;
}) {
  const { database } = useAppState();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      salePrice: salePriceOverride === null ? "" : String(salePriceOverride),
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      setNotice(null);
      try {
        const salePrice = parseOptionalInt(value.salePrice, "Sale price");
        await setRecipeSaleOverride(database.db, recipeId, salePrice);
        await router.invalidate();
        form.setFieldValue("salePrice", salePrice === null ? "" : String(salePrice));
        setNotice("Saved.");
      } catch (caught) {
        setFormError(caught instanceof Error ? caught.message : "Could not save the sale price.");
      }
    },
  });

  return (
    <Flex asChild direction="column" gap="3">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="salePrice"
          validators={{
            onChange: ({ value }) => invalidMessage(() => parseOptionalInt(value, "Sale price")),
            onSubmit: ({ value }) => invalidMessage(() => parseOptionalInt(value, "Sale price")),
          }}
        >
          {(field) => (
            <FormField
              id="sale-price-override"
              label="Sale override"
              hint={`Blank follows the margin. A number here is the sale price in ${currencyLabel} and replaces both rates.`}
              error={firstFieldError(field.state.meta.errors)}
            >
              <IntegerInput
                id="sale-price-override"
                ariaLabel="Sale override"
                placeholder="Follow the margin"
                value={field.state.value}
                width="12rem"
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            </FormField>
          )}
        </form.Field>
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
                Save sale price
              </Button>
            </Flex>
          )}
        </form.Subscribe>
      </form>
    </Flex>
  );
}
