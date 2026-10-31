import { createFileRoute } from "@tanstack/react-router";
import { pageError } from "@/components/PageError";
import { pagePending } from "@/components/PagePending";
import { listIngredients } from "@/db/catalog";
import { openAppDatabase } from "@/db/open";
import { NewRecipePage } from "@/pages/catalog/NewRecipePage";

export const Route = createFileRoute("/catalog/new")({
  loader: async () => {
    const database = await openAppDatabase();
    return listIngredients(database.db);
  },
  component: NewRecipePage,
  pendingComponent: pagePending("Loading ingredients…"),
  errorComponent: pageError("Could not open a new dish."),
});
