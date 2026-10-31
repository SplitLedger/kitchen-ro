import { createFileRoute } from "@tanstack/react-router";
import { pageError } from "@/components/PageError";
import { pagePending } from "@/components/PagePending";
import { openAppDatabase } from "@/db/open";
import { NewIngredientPage } from "@/pages/ingredients/NewIngredientPage";

export const Route = createFileRoute("/ingredients/new")({
  loader: async () => {
    const database = await openAppDatabase();
    const settings = await database.readSettings();
    return settings.currencyLabel;
  },
  component: NewIngredientPage,
  pendingComponent: pagePending("Loading…"),
  errorComponent: pageError("Could not open a new ingredient."),
});
