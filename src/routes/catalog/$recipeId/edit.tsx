import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageError } from "@/components/PageError";
import { pagePending } from "@/components/PagePending";
import { getCatalogRecipe, listIngredients } from "@/db/catalog";
import { openAppDatabase } from "@/db/open";
import { EditRecipePage } from "@/pages/catalog/$recipeId/EditRecipePage";
import { RecipeMissing } from "@/pages/catalog/$recipeId/RecipeMissing";

export const Route = createFileRoute("/catalog/$recipeId/edit")({
  loader: async ({ params }) => {
    const recipeId = Number(params.recipeId);
    if (!Number.isInteger(recipeId) || recipeId < 1) {
      throw notFound();
    }
    const database = await openAppDatabase();
    const recipe = await getCatalogRecipe(database.db, recipeId);
    if (!recipe) {
      throw notFound();
    }
    const ingredients = await listIngredients(database.db);
    return { recipe, ingredients };
  },
  component: EditRecipePage,
  pendingComponent: pagePending("Loading the recipe…"),
  errorComponent: pageError("Could not load this recipe."),
  notFoundComponent: RecipeMissing,
});
