import { createFileRoute } from "@tanstack/react-router";
import { pageError } from "@/components/PageError";
import { pagePending } from "@/components/PagePending";
import { listCookingKits, listIngredients } from "@/db/catalog";
import { listInventoryLots } from "@/db/inventory";
import { openAppDatabase } from "@/db/open";
import { InventoryPage } from "@/pages/InventoryPage";

export const Route = createFileRoute("/inventory")({
  loader: async () => {
    const database = await openAppDatabase();
    const [ingredients, kits, lots, settings] = await Promise.all([
      listIngredients(database.db),
      listCookingKits(database.db, { includeArchived: true }),
      listInventoryLots(database.db),
      database.readSettings(),
    ]);
    return { ingredients, kits, lots, currencyLabel: settings.currencyLabel };
  },
  component: InventoryPage,
  pendingComponent: pagePending("Loading inventory…"),
  errorComponent: pageError("Could not load inventory."),
});
