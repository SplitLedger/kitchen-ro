import { Button, Flex, Grid } from "@radix-ui/themes";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { FormField } from "@/components/FormField";
import { IntegerInput } from "@/components/IntegerInput";
import { TextFormControl } from "@/components/TextFormControl";
import { firstFieldError } from "@/components/firstFieldError";
import { nameTakenMessage } from "@/components/nameTakenMessage";
import { createIngredient, updateIngredient } from "@/db/catalog-edit";
import type { CatalogIngredient } from "@/db/catalog";
import type { KitchenDatabase } from "@/db/client";
import { invalidMessage, parseCatalogName, parseOptionalInt } from "@/domain/catalog/edit";

export function IngredientForm({
  db,
  currencyLabel,
  ingredient,
  onSaved,
}: {
  db: KitchenDatabase;
  currencyLabel: string;
  ingredient?: CatalogIngredient;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const form = useForm({
    defaultValues: {
      name: ingredient?.name ?? "",
      referencePrice:
        ingredient?.referencePrice === undefined || ingredient.referencePrice === null
          ? ""
          : String(ingredient.referencePrice),
    },
    onSubmit: async ({ value }) => {
      try {
        const draft = {
          name: parseCatalogName(value.name),
          referencePrice: parseOptionalInt(value.referencePrice, "Reference price"),
        };
        if (ingredient) {
          await updateIngredient(db, ingredient.id, draft);
          await router.invalidate();
          onSaved?.();
          return;
        }
        const id = await createIngredient(db, draft);
        await router.invalidate();
        await navigate({
          to: "/ingredients/$ingredientId",
          params: { ingredientId: String(id) },
        });
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "Could not save the ingredient.");
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
        <Grid columns={{ initial: "1", sm: "2" }} gap="4">
          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => invalidMessage(() => parseCatalogName(value)),
              onSubmit: ({ value }) => invalidMessage(() => parseCatalogName(value)),
              onBlurAsync: ({ value }) => nameTakenMessage(db, "ingredient", value, ingredient?.id),
              onSubmitAsync: ({ value }) =>
                nameTakenMessage(db, "ingredient", value, ingredient?.id),
            }}
          >
            {(field) => (
              <TextFormControl
                id="ingredient-name"
                label="Name"
                value={field.state.value}
                error={firstFieldError(field.state.meta.errors)}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
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
                id="ingredient-reference-price"
                label="NPC reference price"
                hint={`Shop price in ${currencyLabel}. Leave blank when there is none. Add a lot on Inventory for a price you pay.`}
                error={firstFieldError(field.state.meta.errors)}
              >
                <IntegerInput
                  id="ingredient-reference-price"
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
        </Grid>
        <Flex gap="3" align="center">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" loading={isSubmitting}>
                Save
              </Button>
            )}
          </form.Subscribe>
          <Button asChild variant="soft" color="gray">
            <Link to="/ingredients">Cancel</Link>
          </Button>
        </Flex>
      </form>
    </Flex>
  );
}
