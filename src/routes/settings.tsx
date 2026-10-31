import { createFileRoute } from "@tanstack/react-router";
import { pageError } from "@/components/PageError";
import { pagePending } from "@/components/PagePending";
import { listCookingKits } from "@/db/catalog";
import { openAppDatabase } from "@/db/open";
import { SettingsPage } from "@/pages/SettingsPage";

export const Route = createFileRoute("/settings")({
  loader: async () => {
    const database = await openAppDatabase();
    const kits = await listCookingKits(database.db);
    return { kits };
  },
  component: SettingsPage,
  pendingComponent: pagePending("Loading settings…"),
  errorComponent: pageError("Could not load settings."),
});
