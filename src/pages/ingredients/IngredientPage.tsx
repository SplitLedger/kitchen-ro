import { Callout, Flex, Heading, Link as ThemeLink, Text } from "@radix-ui/themes";
import { Link, getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { CatalogBadges } from "@/components/CatalogBadges";
import { CatalogRecordActions } from "@/components/CatalogRecordActions";
import { IngredientForm } from "@/components/IngredientForm";
import { deleteIngredient, resetIngredient, setIngredientArchived } from "@/db/catalog-edit";
import { ingredientDiffersFromSeed } from "@/domain/catalog/edit";
import { useAppState } from "@/providers/AppStateProvider";

const routeApi = getRouteApi("/ingredients/$ingredientId");

export function IngredientPage() {
  const { ingredient, currencyLabel } = routeApi.useLoaderData();
  const { database } = useAppState();
  const router = useRouter();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<string | null>(null);
  const edited = ingredientDiffersFromSeed(ingredient);

  return (
    <Flex direction="column" gap="4">
      <ThemeLink asChild>
        <Link to="/ingredients">Back to ingredients</Link>
      </ThemeLink>
      <Flex align="center" gap="2" wrap="wrap">
        <Heading as="h1" size="6">
          {ingredient.name}
        </Heading>
        <CatalogBadges
          archived={ingredient.archived}
          custom={ingredient.origin === "custom"}
          edited={edited}
        />
      </Flex>
      {ingredient.archived ? (
        <Callout.Root color="gray" variant="surface">
          <Callout.Text>
            This ingredient is archived, so it stays off new dishes until you unarchive it.
          </Callout.Text>
        </Callout.Root>
      ) : null}
      {notice ? <Text color="green">{notice}</Text> : null}
      <IngredientForm
        key={`${ingredient.id}:${ingredient.name}:${ingredient.referencePrice ?? ""}:${ingredient.archived}`}
        currencyLabel={currencyLabel}
        db={database.db}
        ingredient={ingredient}
        onSaved={() => {
          setNotice("Saved.");
        }}
      />
      <CatalogRecordActions
        archived={ingredient.archived}
        onArchive={async (archived) => {
          await setIngredientArchived(database.db, ingredient.id, archived);
          await router.invalidate();
          setNotice(archived ? "Archived." : "Restored to the ingredient list.");
        }}
        reset={
          ingredient.origin === "official" && edited
            ? {
                title: "Reset this ingredient?",
                description: `Restore ${ingredient.name} from the official seed. The name and NPC reference price are replaced.`,
                onAction: async () => {
                  await resetIngredient(database.db, ingredient.id);
                  await router.invalidate();
                  setNotice("Restored from the official seed.");
                },
              }
            : undefined
        }
        deleteAction={
          ingredient.origin === "custom"
            ? {
                title: "Delete this ingredient?",
                description: `Delete ${ingredient.name}? This cannot be undone.`,
                onAction: async () => {
                  await deleteIngredient(database.db, ingredient.id);
                  await router.invalidate();
                  await navigate({ to: "/ingredients" });
                },
              }
            : undefined
        }
      />
    </Flex>
  );
}
