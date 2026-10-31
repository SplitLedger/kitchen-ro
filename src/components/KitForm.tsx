import { Box, Button, Checkbox, Flex, Grid, Text } from "@radix-ui/themes";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { FormField } from "@/components/FormField";
import { IntegerInput } from "@/components/IntegerInput";
import { TextFormControl } from "@/components/TextFormControl";
import { firstFieldError } from "@/components/firstFieldError";
import { nameTakenMessage } from "@/components/nameTakenMessage";
import type { CatalogKit } from "@/db/catalog";
import { createKit, updateKit } from "@/db/catalog-edit";
import type { KitchenDatabase } from "@/db/client";
import {
  invalidMessage,
  parseCatalogName,
  parseOptionalInt,
  parseRequiredInt,
} from "@/domain/catalog/edit";

export function KitForm({
  db,
  currencyLabel,
  kit,
  onSaved,
}: {
  db: KitchenDatabase;
  currencyLabel: string;
  kit?: CatalogKit;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const form = useForm({
    defaultValues: {
      name: kit?.name ?? "",
      produceValue: kit ? String(kit.produceValue) : "11",
      alwaysSuccess: kit?.alwaysSuccess ?? false,
      referencePrice:
        kit?.referencePrice === undefined || kit.referencePrice === null
          ? ""
          : String(kit.referencePrice),
    },
    onSubmit: async ({ value }) => {
      try {
        const draft = {
          name: parseCatalogName(value.name),
          produceValue: parseRequiredInt(value.produceValue, "Produce value", 0),
          alwaysSuccess: value.alwaysSuccess,
          referencePrice: parseOptionalInt(value.referencePrice, "Reference price"),
        };
        if (kit) {
          await updateKit(db, kit.id, draft);
          await router.invalidate();
          onSaved?.();
          return;
        }
        const id = await createKit(db, draft);
        await router.invalidate();
        await navigate({ to: "/catalog/kits/$kitId", params: { kitId: String(id) } });
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "Could not save the kit.");
      }
    },
  });

  return (
    <Grid asChild columns={{ initial: "1", md: "2" }} gap="4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <Box style={{ gridColumn: "1 / -1" }}>
          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => invalidMessage(() => parseCatalogName(value)),
              onSubmit: ({ value }) => invalidMessage(() => parseCatalogName(value)),
              onBlurAsync: ({ value }) => nameTakenMessage(db, "kit", value, kit?.id),
              onSubmitAsync: ({ value }) => nameTakenMessage(db, "kit", value, kit?.id),
            }}
          >
            {(field) => (
              <TextFormControl
                id="kit-name"
                label="Name"
                value={field.state.value}
                error={firstFieldError(field.state.meta.errors)}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          </form.Field>
        </Box>
        <form.Field
          name="produceValue"
          validators={{
            onChange: ({ value }) =>
              invalidMessage(() => parseRequiredInt(value, "Produce value", 0)),
            onSubmit: ({ value }) =>
              invalidMessage(() => parseRequiredInt(value, "Produce value", 0)),
          }}
        >
          {(field) => (
            <FormField
              id="kit-produce-value"
              label="Produce value"
              hint="Official kits use 11 through 15. A higher value is a stronger kit."
              error={firstFieldError(field.state.meta.errors)}
            >
              <IntegerInput
                id="kit-produce-value"
                ariaLabel="Produce value"
                value={field.state.value}
                width="8rem"
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            </FormField>
          )}
        </form.Field>
        <form.Field name="alwaysSuccess">
          {(field) => (
            <Flex align="center" gap="2">
              <Checkbox
                checked={field.state.value}
                id="kit-always-success"
                onCheckedChange={(checked) => {
                  field.handleChange(checked === true);
                }}
              />
              <Text as="label" htmlFor="kit-always-success" size="2">
                Always succeeds
              </Text>
            </Flex>
          )}
        </form.Field>
        <form.Field
          name="referencePrice"
          validators={{
            onChange: ({ value }) =>
              invalidMessage(() => parseOptionalInt(value, "Reference price")),
            onSubmit: ({ value }) =>
              invalidMessage(() => parseOptionalInt(value, "Reference price")),
          }}
        >
          {(field) => (
            <FormField
              id="kit-reference-price"
              label="NPC reference price"
              hint={`Shop price in ${currencyLabel}. Leave blank when there is none. Add a lot on Inventory for a price you pay.`}
              error={firstFieldError(field.state.meta.errors)}
            >
              <IntegerInput
                id="kit-reference-price"
                ariaLabel="NPC reference price"
                placeholder="Blank if none"
                value={field.state.value}
                width="12rem"
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            </FormField>
          )}
        </form.Field>
        <Flex align="center" gap="3" style={{ gridColumn: "1 / -1" }}>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" loading={isSubmitting}>
                Save
              </Button>
            )}
          </form.Subscribe>
          <Button asChild variant="soft" color="gray">
            <Link to="/catalog">Cancel</Link>
          </Button>
        </Flex>
      </form>
    </Grid>
  );
}
