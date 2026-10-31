import { Flex, Heading, Link as ThemeLink, Text } from "@radix-ui/themes";
import { Link, getRouteApi } from "@tanstack/react-router";
import { RecipeForm } from "@/components/RecipeForm";
import { useAppState } from "@/providers/AppStateProvider";

const routeApi = getRouteApi("/catalog/$recipeId/edit");

export function EditRecipePage() {
  const { recipe, ingredients } = routeApi.useLoaderData();
  const { database } = useAppState();

  return (
    <Flex direction="column" gap="4">
      <ThemeLink asChild>
        <Link params={{ recipeId: String(recipe.id) }} to="/catalog/$recipeId">
          Back to dish
        </Link>
      </ThemeLink>
      <Heading as="h1" size="6">
        Edit {recipe.name}
      </Heading>
      <Text color="gray">
        {recipe.origin === "official"
          ? "Saving an official dish marks it as edited. Reset on the dish page restores the seed."
          : "Custom dishes can be deleted while no confirmed order uses them."}
      </Text>
      <RecipeForm
        key={`${recipe.id}:${recipe.name}:${recipe.level}:${recipe.items.map((item) => `${item.ingredientId}:${item.quantity}`).join(",")}`}
        db={database.db}
        ingredients={ingredients}
        recipe={recipe}
      />
    </Flex>
  );
}
