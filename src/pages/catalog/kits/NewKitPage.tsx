import { Flex, Heading, Link as ThemeLink, Text } from "@radix-ui/themes";
import { Link, getRouteApi } from "@tanstack/react-router";
import { KitForm } from "@/components/KitForm";
import { useAppState } from "@/providers/AppStateProvider";

const routeApi = getRouteApi("/catalog/kits/new");

export function NewKitPage() {
  const currencyLabel = routeApi.useLoaderData();
  const { database } = useAppState();

  return (
    <Flex direction="column" gap="4">
      <ThemeLink asChild>
        <Link to="/catalog">Back to catalog</Link>
      </ThemeLink>
      <Heading as="h1" size="6">
        New kit
      </Heading>
      <Text color="gray">
        Add a kit when this server sells one that is not in the official list.
      </Text>
      <KitForm currencyLabel={currencyLabel} db={database.db} />
    </Flex>
  );
}
