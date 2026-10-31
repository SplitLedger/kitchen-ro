import { createFileRoute } from "@tanstack/react-router";
import { pageError } from "@/components/PageError";
import { pagePending } from "@/components/PagePending";
import { openAppDatabase } from "@/db/open";
import { NewKitPage } from "@/pages/catalog/kits/NewKitPage";

export const Route = createFileRoute("/catalog/kits/new")({
  loader: async () => {
    const database = await openAppDatabase();
    const settings = await database.readSettings();
    return settings.currencyLabel;
  },
  component: NewKitPage,
  pendingComponent: pagePending("Loading…"),
  errorComponent: pageError("Could not open a new kit."),
});
