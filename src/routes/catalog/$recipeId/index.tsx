import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageError } from "@/components/PageError";
import { pagePending } from "@/components/PagePending";
import { getCatalogRecipe, listCookingKits } from "@/db/catalog";
import { loadPriceBook } from "@/db/inventory";
import { openAppDatabase } from "@/db/open";
import { RecipeMissing } from "@/pages/catalog/$recipeId/RecipeMissing";
import { RecipePage } from "@/pages/catalog/$recipeId/RecipePage";

export const Route = createFileRoute("/catalog/$recipeId/")({
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
    const [kits, prices] = await Promise.all([
      listCookingKits(database.db),
      loadPriceBook(database.db),
    ]);
    return { recipe, kits, prices };
  },
  component: RecipePage,
  pendingComponent: pagePending("Loading the recipe…"),
  errorComponent: pageError("Could not load this recipe."),
  notFoundComponent: RecipeMissing,
});
