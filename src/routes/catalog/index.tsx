import { createFileRoute } from "@tanstack/react-router";
import { pageError } from "@/components/PageError";
import { pagePending } from "@/components/PagePending";
import { listCatalogRecipes, listCookingKits } from "@/db/catalog";
import { openAppDatabase } from "@/db/open";
import { CatalogPage } from "@/pages/catalog/CatalogPage";

export const Route = createFileRoute("/catalog/")({
  loader: async () => {
    const database = await openAppDatabase();
    const [dishes, kits] = await Promise.all([
      listCatalogRecipes(database.db, { includeArchived: true }),
      listCookingKits(database.db, { includeArchived: true }),
    ]);
    return { dishes, kits };
  },
  component: CatalogPage,
  pendingComponent: pagePending("Loading the catalog…"),
  errorComponent: pageError("Could not load the catalog."),
});
