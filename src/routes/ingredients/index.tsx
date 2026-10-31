import { createFileRoute } from "@tanstack/react-router";
import { pageError } from "@/components/PageError";
import { pagePending } from "@/components/PagePending";
import { listIngredients } from "@/db/catalog";
import { openAppDatabase } from "@/db/open";
import { IngredientsPage } from "@/pages/ingredients/IngredientsPage";

export const Route = createFileRoute("/ingredients/")({
  loader: async () => {
    const database = await openAppDatabase();
    const [ingredients, settings] = await Promise.all([
      listIngredients(database.db),
      database.readSettings(),
    ]);
    return { ingredients, currencyLabel: settings.currencyLabel };
  },
  component: IngredientsPage,
  pendingComponent: pagePending("Loading ingredients…"),
  errorComponent: pageError("Could not load ingredients."),
});
