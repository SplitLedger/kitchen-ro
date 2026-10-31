import { Button, Checkbox, Flex, Heading, Text, TextField } from "@radix-ui/themes";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { IngredientTable } from "@/pages/ingredients/IngredientTable";

const routeApi = getRouteApi("/ingredients/");

export function IngredientsPage() {
  const { ingredients, currencyLabel } = routeApi.useLoaderData();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const needle = query.trim().toLowerCase();
  const visible = ingredients.filter((ingredient) => {
    if (!showArchived && ingredient.archived) {
      return false;
    }
    if (!needle) {
      return true;
    }
    return ingredient.name.toLowerCase().includes(needle);
  });

  return (
    <Flex direction="column" gap="4">
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Heading as="h1" size="6">
          Ingredients
        </Heading>
        <Button asChild variant="soft">
          <Link to="/ingredients/new">New ingredient</Link>
        </Button>
      </Flex>
      <Text color="gray">
        Names have to be unique. Official ingredients can be edited and reset. Archive one to hide
        it from new dishes.
      </Text>
      <Flex align="center" gap="3" wrap="wrap">
        <TextField.Root
          aria-label="Search ingredients"
          placeholder="Search ingredients"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          style={{ width: "min(100%, 24rem)" }}
        />
        <Flex align="center" gap="2">
          <Checkbox
            checked={showArchived}
            id="show-archived-ingredients"
            onCheckedChange={(checked) => {
              setShowArchived(checked === true);
            }}
          />
          <Text as="label" htmlFor="show-archived-ingredients" size="2">
            Show archived
          </Text>
        </Flex>
      </Flex>
      <Text color="gray" size="2">
        {visible.length} {visible.length === 1 ? "ingredient" : "ingredients"}
      </Text>
      {visible.length === 0 ? (
        <Text color="gray">No ingredients match this filter.</Text>
      ) : (
        <IngredientTable currencyLabel={currencyLabel} ingredients={visible} />
      )}
    </Flex>
  );
}
