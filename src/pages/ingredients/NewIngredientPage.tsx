import { Flex, Heading, Link as ThemeLink } from "@radix-ui/themes";
import { Link, getRouteApi } from "@tanstack/react-router";
import { IngredientForm } from "@/components/IngredientForm";
import { useAppState } from "@/providers/AppStateProvider";

const routeApi = getRouteApi("/ingredients/new");

export function NewIngredientPage() {
  const currencyLabel = routeApi.useLoaderData();
  const { database } = useAppState();

  return (
    <Flex direction="column" gap="4">
      <ThemeLink asChild>
        <Link to="/ingredients">Back to ingredients</Link>
      </ThemeLink>
      <Heading as="h1" size="6">
        New ingredient
      </Heading>
      <IngredientForm currencyLabel={currencyLabel} db={database.db} />
    </Flex>
  );
}
