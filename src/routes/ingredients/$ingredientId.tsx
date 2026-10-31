import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageError } from "@/components/PageError";
import { pagePending } from "@/components/PagePending";
import { getIngredient } from "@/db/catalog";
import { openAppDatabase } from "@/db/open";
import { IngredientMissing } from "@/pages/ingredients/IngredientMissing";
import { IngredientPage } from "@/pages/ingredients/IngredientPage";

export const Route = createFileRoute("/ingredients/$ingredientId")({
  loader: async ({ params }) => {
    const ingredientId = Number(params.ingredientId);
    if (!Number.isInteger(ingredientId) || ingredientId < 1) {
      throw notFound();
    }
    const database = await openAppDatabase();
    const ingredient = await getIngredient(database.db, ingredientId);
    if (!ingredient) {
      throw notFound();
    }
    const settings = await database.readSettings();
    return { ingredient, currencyLabel: settings.currencyLabel };
  },
  component: IngredientPage,
  pendingComponent: pagePending("Loading the ingredient…"),
  errorComponent: pageError("Could not load this ingredient."),
  notFoundComponent: IngredientMissing,
});
