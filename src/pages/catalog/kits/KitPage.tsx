import { Callout, Flex, Heading, Link as ThemeLink } from "@radix-ui/themes";
import { Link, getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { CatalogBadges } from "@/components/CatalogBadges";
import { CatalogRecordActions } from "@/components/CatalogRecordActions";
import { KitForm } from "@/components/KitForm";
import { deleteKit, resetKit, setKitArchived } from "@/db/catalog-edit";
import { kitDiffersFromSeed } from "@/domain/catalog/edit";
import { useAppState } from "@/providers/AppStateProvider";

const routeApi = getRouteApi("/catalog/kits/$kitId");

export function KitPage() {
  const { kit, currencyLabel } = routeApi.useLoaderData();
  const { database } = useAppState();
  const router = useRouter();
  const navigate = useNavigate();
  const edited = kitDiffersFromSeed(kit);

  return (
    <Flex direction="column" gap="4">
      <ThemeLink asChild>
        <Link to="/catalog">Back to catalog</Link>
      </ThemeLink>
      <Flex align="center" gap="2" wrap="wrap">
        <Heading as="h1" size="6">
          {kit.name}
        </Heading>
        <CatalogBadges archived={kit.archived} custom={kit.origin === "custom"} edited={edited} />
      </Flex>
      {kit.archived ? (
        <Callout.Root color="gray" variant="surface">
          <Callout.Text>This kit is archived, so it is hidden from recipe pages.</Callout.Text>
        </Callout.Root>
      ) : null}
      <KitForm
        key={`${kit.id}:${kit.name}:${kit.produceValue}:${kit.alwaysSuccess}:${kit.referencePrice ?? ""}:${kit.archived}`}
        currencyLabel={currencyLabel}
        db={database.db}
        kit={kit}
        onSaved={() => {
          toast.success("Saved.");
        }}
      />
      <CatalogRecordActions
        archived={kit.archived}
        onArchive={async (archived) => {
          await setKitArchived(database.db, kit.id, archived);
          await router.invalidate();
          toast.success(archived ? "Archived." : "Restored to the kit list.");
        }}
        reset={
          kit.origin === "official" && edited
            ? {
                title: "Reset this kit?",
                description: `Restore ${kit.name} from the official seed. The name, produce value, always-succeeds flag, and NPC reference price are replaced.`,
                onAction: async () => {
                  await resetKit(database.db, kit.id);
                  await router.invalidate();
                  toast.success("Restored from the official seed.");
                },
              }
            : undefined
        }
        deleteAction={
          kit.origin === "custom"
            ? {
                title: "Delete this kit?",
                description: `Delete ${kit.name}? This cannot be undone.`,
                onAction: async () => {
                  await deleteKit(database.db, kit.id);
                  await router.invalidate();
                  await navigate({ to: "/catalog" });
                },
              }
            : undefined
        }
      />
    </Flex>
  );
}
