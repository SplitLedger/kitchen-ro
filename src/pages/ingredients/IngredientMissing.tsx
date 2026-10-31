import { Flex, Heading, Link as ThemeLink } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";

export function IngredientMissing() {
  return (
    <Flex direction="column" gap="3">
      <Heading as="h1" size="6">
        Ingredient not found
      </Heading>
      <ThemeLink asChild>
        <Link to="/ingredients">Back to ingredients</Link>
      </ThemeLink>
    </Flex>
  );
}
