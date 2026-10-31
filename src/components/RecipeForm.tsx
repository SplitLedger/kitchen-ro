import { Button, Callout, Flex, Grid, Link as ThemeLink, Select, Text } from "@radix-ui/themes";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { FormField } from "@/components/FormField";
import { IntegerInput } from "@/components/IntegerInput";
import { TextFormControl } from "@/components/TextFormControl";
import { firstFieldError } from "@/components/firstFieldError";
import { nameTakenMessage } from "@/components/nameTakenMessage";
import type { CatalogIngredient, CatalogRecipe } from "@/db/catalog";
import { createRecipe, updateRecipe } from "@/db/catalog-edit";
import type { KitchenDatabase } from "@/db/client";
import {
  assertRecipeItems,
  invalidMessage,
  parseCatalogName,
  parseCookbookLabel,
  parseRequiredInt,
} from "@/domain/catalog/edit";
import { foodStatLabels, foodStats, isFoodStat, type FoodStat } from "@/domain/catalog/food-stat";

type RecipeItemValues = {
  ingredientId: string;
  quantity: string;
};

type RecipeFormValues = {
  name: string;
  stat: FoodStat;
  level: string;
  weight: string;
  hpRegen: string;
  spRegen: string;
  statBonus: string;
  cookbookLabel: string;
  items: RecipeItemValues[];
};

function emptyRecipe(): RecipeFormValues {
  return {
    name: "",
    stat: "str",
    level: "1",
    weight: "0",
    hpRegen: "0",
    spRegen: "0",
    statBonus: "0",
    cookbookLabel: "Level 1 Cookbook",
    items: [{ ingredientId: "", quantity: "1" }],
  };
}

function valuesFromRecipe(recipe: CatalogRecipe): RecipeFormValues {
  return {
    name: recipe.name,
    stat: recipe.stat,
    level: String(recipe.level),
    weight: String(recipe.weight),
    hpRegen: String(recipe.hpRegen),
    spRegen: String(recipe.spRegen),
    statBonus: String(recipe.statBonus),
    cookbookLabel: recipe.cookbookLabel,
    items: recipe.items.map((item) => ({
      ingredientId: String(item.ingredientId),
      quantity: String(item.quantity),
    })),
  };
}

function cookbookForLevel(level: string): string | null {
  if (!/^\d+$/.test(level)) {
    return null;
  }
  return `Level ${Number(level)} Cookbook`;
}

export function RecipeForm({
  db,
  ingredients,
  recipe,
}: {
  db: KitchenDatabase;
  ingredients: CatalogIngredient[];
  recipe?: CatalogRecipe;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: recipe ? valuesFromRecipe(recipe) : emptyRecipe(),
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        const draft = {
          name: parseCatalogName(value.name),
          stat: value.stat,
          level: parseRequiredInt(value.level, "Level", 1),
          weight: parseRequiredInt(value.weight, "Weight", 0),
          hpRegen: parseRequiredInt(value.hpRegen, "HP regen", 0),
          spRegen: parseRequiredInt(value.spRegen, "SP regen", 0),
          statBonus: parseRequiredInt(value.statBonus, "Stat bonus", 0),
          cookbookLabel: parseCookbookLabel(value.cookbookLabel),
          items: value.items.map((item) => ({
            ingredientId: parseRequiredInt(item.ingredientId, "Ingredient", 1),
            quantity: parseRequiredInt(item.quantity, "Quantity", 1),
          })),
        };
        assertRecipeItems(draft.items);
        if (recipe) {
          await updateRecipe(db, recipe.id, draft);
          await router.invalidate();
          await navigate({
            to: "/catalog/$recipeId",
            params: { recipeId: String(recipe.id) },
          });
          return;
        }
        const id = await createRecipe(db, draft);
        await router.invalidate();
        await navigate({ to: "/catalog/$recipeId", params: { recipeId: String(id) } });
      } catch (caught) {
        setFormError(caught instanceof Error ? caught.message : "Could not save the dish.");
      }
    },
  });

  const numberField = (
    fieldDef: (typeof numberFields)[number],
    onValueChange?: (next: string, previous: string) => void,
  ) => (
    <form.Field
      key={fieldDef.name}
      name={fieldDef.name}
      validators={{
        onChange: ({ value }) =>
          invalidMessage(() => parseRequiredInt(value, fieldDef.label, fieldDef.minimum)),
        onSubmit: ({ value }) =>
          invalidMessage(() => parseRequiredInt(value, fieldDef.label, fieldDef.minimum)),
      }}
    >
      {(field) => (
        <FormField
          id={`recipe-${fieldDef.name}`}
          label={fieldDef.label}
          error={firstFieldError(field.state.meta.errors)}
        >
          <IntegerInput
            id={`recipe-${fieldDef.name}`}
            ariaLabel={fieldDef.label}
            value={field.state.value}
            width="8rem"
            onBlur={field.handleBlur}
            onChange={(next) => {
              const previous = field.state.value;
              field.handleChange(next);
              onValueChange?.(next, previous);
            }}
          />
        </FormField>
      )}
    </form.Field>
  );

  return (
    <Flex asChild direction="column" gap="5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <Grid columns={{ initial: "1", lg: "2" }} gap="5">
          <Flex direction="column" gap="4" minWidth="0">
            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) => invalidMessage(() => parseCatalogName(value)),
                onSubmit: ({ value }) => invalidMessage(() => parseCatalogName(value)),
                onBlurAsync: ({ value }) => nameTakenMessage(db, "recipe", value, recipe?.id),
                onSubmitAsync: ({ value }) => nameTakenMessage(db, "recipe", value, recipe?.id),
              }}
            >
              {(field) => (
                <TextFormControl
                  id="recipe-name"
                  label="Name"
                  value={field.state.value}
                  error={firstFieldError(field.state.meta.errors)}
                  onBlur={field.handleBlur}
                  onChange={field.handleChange}
                />
              )}
            </form.Field>
            <Flex gap="3" wrap="wrap">
              <form.Field name="stat">
                {(field) => (
                  <FormField label="Stat">
                    <Select.Root
                      value={field.state.value}
                      onValueChange={(value) => {
                        if (isFoodStat(value)) {
                          field.handleChange(value);
                        }
                      }}
                    >
                      <Select.Trigger aria-label="Stat" />
                      <Select.Content>
                        {foodStats.map((stat) => (
                          <Select.Item key={stat} value={stat}>
                            {foodStatLabels[stat]}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                  </FormField>
                )}
              </form.Field>
              {numberFields.slice(0, 2).map((fieldDef) =>
                numberField(
                  fieldDef,
                  fieldDef.name === "level"
                    ? (next, previous) => {
                        const previousCookbook = cookbookForLevel(previous);
                        const nextCookbook = cookbookForLevel(next);
                        if (!previousCookbook || !nextCookbook) {
                          return;
                        }
                        if (form.getFieldValue("cookbookLabel") === previousCookbook) {
                          form.setFieldValue("cookbookLabel", nextCookbook);
                        }
                      }
                    : undefined,
                ),
              )}
            </Flex>
            <Flex gap="3" wrap="wrap">
              {numberFields.slice(2).map((fieldDef) => numberField(fieldDef))}
            </Flex>
            <form.Field
              name="cookbookLabel"
              validators={{
                onChange: ({ value }) => invalidMessage(() => parseCookbookLabel(value)),
                onSubmit: ({ value }) => invalidMessage(() => parseCookbookLabel(value)),
              }}
            >
              {(field) => (
                <TextFormControl
                  id="recipe-cookbook"
                  label="Cookbook note"
                  hint="Shown as a requirement. Cookbooks are not consumed and are not part of the cost."
                  value={field.state.value}
                  error={firstFieldError(field.state.meta.errors)}
                  onBlur={field.handleBlur}
                  onChange={field.handleChange}
                />
              )}
            </form.Field>
          </Flex>
          <Flex direction="column" gap="2" minWidth="0">
            <Text size="2" weight="medium">
              Ingredients
            </Text>
            <Text color="gray" size="1">
              A dish needs at least one ingredient. Each ingredient can only appear once.
            </Text>
            <form.Field name="items" mode="array">
              {(field) => (
                <Flex direction="column" gap="3">
                  <Grid columns={{ initial: "1", xl: "2" }} gap="3">
                    {field.state.value.map((item, index) => {
                      const taken = new Set(
                        field.state.value
                          .filter((_, other) => other !== index)
                          .map((row) => row.ingredientId)
                          .filter((id) => id !== ""),
                      );
                      const choices = ingredients.filter(
                        (ingredient) =>
                          !ingredient.archived || String(ingredient.id) === item.ingredientId,
                      );
                      return (
                        <Flex key={index} align="end" gap="3" wrap="wrap">
                          <form.Field
                            name={`items[${index}].ingredientId`}
                            validators={{
                              onSubmit: ({ value }) =>
                                invalidMessage(() => parseRequiredInt(value, "Ingredient", 1)),
                            }}
                          >
                            {(ingredientField) => (
                              <FormField
                                label="Ingredient"
                                error={firstFieldError(ingredientField.state.meta.errors)}
                              >
                                <Select.Root
                                  value={ingredientField.state.value}
                                  onValueChange={ingredientField.handleChange}
                                >
                                  <Select.Trigger
                                    aria-label={`Ingredient ${index + 1}`}
                                    placeholder="Choose an ingredient"
                                  />
                                  <Select.Content>
                                    {choices.map((ingredient) => (
                                      <Select.Item
                                        key={ingredient.id}
                                        disabled={taken.has(String(ingredient.id))}
                                        value={String(ingredient.id)}
                                      >
                                        {ingredient.name}
                                      </Select.Item>
                                    ))}
                                  </Select.Content>
                                </Select.Root>
                              </FormField>
                            )}
                          </form.Field>
                          <form.Field
                            name={`items[${index}].quantity`}
                            validators={{
                              onChange: ({ value }) =>
                                invalidMessage(() => parseRequiredInt(value, "Quantity", 1)),
                              onSubmit: ({ value }) =>
                                invalidMessage(() => parseRequiredInt(value, "Quantity", 1)),
                            }}
                          >
                            {(quantityField) => (
                              <FormField
                                id={`recipe-quantity-${index}`}
                                label="Quantity"
                                error={firstFieldError(quantityField.state.meta.errors)}
                              >
                                <IntegerInput
                                  id={`recipe-quantity-${index}`}
                                  ariaLabel={`Quantity ${index + 1}`}
                                  value={quantityField.state.value}
                                  width="8rem"
                                  onBlur={quantityField.handleBlur}
                                  onChange={quantityField.handleChange}
                                />
                              </FormField>
                            )}
                          </form.Field>
                          {field.state.value.length > 1 ? (
                            <Button
                              type="button"
                              variant="soft"
                              color="gray"
                              onClick={() => {
                                field.removeValue(index);
                              }}
                            >
                              Remove
                            </Button>
                          ) : null}
                        </Flex>
                      );
                    })}
                  </Grid>
                  <Flex align="center" gap="3" wrap="wrap">
                    <Button
                      type="button"
                      variant="soft"
                      onClick={() => {
                        field.pushValue({ ingredientId: "", quantity: "1" });
                      }}
                    >
                      Add ingredient
                    </Button>
                    <ThemeLink asChild>
                      <Link to="/ingredients/new">New ingredient</Link>
                    </ThemeLink>
                  </Flex>
                </Flex>
              )}
            </form.Field>
          </Flex>
        </Grid>
        {formError ? (
          <Callout.Root color="red" variant="surface">
            <Callout.Text>{formError}</Callout.Text>
          </Callout.Root>
        ) : null}
        <Flex gap="3" align="center">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" loading={isSubmitting}>
                Save
              </Button>
            )}
          </form.Subscribe>
          {recipe ? (
            <Button asChild variant="soft" color="gray">
              <Link params={{ recipeId: String(recipe.id) }} to="/catalog/$recipeId">
                Cancel
              </Link>
            </Button>
          ) : (
            <Button asChild variant="soft" color="gray">
              <Link to="/catalog">Cancel</Link>
            </Button>
          )}
        </Flex>
      </form>
    </Flex>
  );
}

const numberFields = [
  { name: "level", label: "Level", minimum: 1 },
  { name: "weight", label: "Weight", minimum: 0 },
  { name: "hpRegen", label: "HP regen", minimum: 0 },
  { name: "spRegen", label: "SP regen", minimum: 0 },
  { name: "statBonus", label: "Stat bonus", minimum: 0 },
] as const;
