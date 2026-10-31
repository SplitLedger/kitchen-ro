import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageError } from "@/components/PageError";
import { pagePending } from "@/components/PagePending";
import { getCookingKit } from "@/db/catalog";
import { openAppDatabase } from "@/db/open";
import { KitMissing } from "@/pages/catalog/kits/KitMissing";
import { KitPage } from "@/pages/catalog/kits/KitPage";

export const Route = createFileRoute("/catalog/kits/$kitId")({
  loader: async ({ params }) => {
    const kitId = Number(params.kitId);
    if (!Number.isInteger(kitId) || kitId < 1) {
      throw notFound();
    }
    const database = await openAppDatabase();
    const kit = await getCookingKit(database.db, kitId);
    if (!kit) {
      throw notFound();
    }
    const settings = await database.readSettings();
    return { kit, currencyLabel: settings.currencyLabel };
  },
  component: KitPage,
  pendingComponent: pagePending("Loading the kit…"),
  errorComponent: pageError("Could not load this kit."),
  notFoundComponent: KitMissing,
});
