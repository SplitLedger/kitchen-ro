import { Flex, Heading, Link as ThemeLink, Text } from "@radix-ui/themes";
import { Link, getRouteApi } from "@tanstack/react-router";
import { RecipeForm } from "@/components/RecipeForm";
import { useAppState } from "@/providers/AppStateProvider";

const routeApi = getRouteApi("/catalog/new");

export function NewRecipePage() {
  const ingredients = routeApi.useLoaderData();
  const { database } = useAppState();

  return (
    <Flex direction="column" gap="4">
      <ThemeLink asChild>
        <Link to="/catalog">Back to catalog</Link>
      </ThemeLink>
      <Heading as="h1" size="6">
        New dish
      </Heading>
      <Text color="gray">
        Custom dishes stay in the catalog until you archive or delete them. Official dishes are
        unchanged.
      </Text>
      <RecipeForm db={database.db} ingredients={ingredients} />
    </Flex>
  );
}
