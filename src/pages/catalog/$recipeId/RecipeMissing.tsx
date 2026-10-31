import { Flex, Heading, Link as ThemeLink, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";

export function RecipeMissing() {
  return (
    <Flex direction="column" gap="3">
      <Heading as="h1" size="6">
        Dish not found
      </Heading>
      <Text color="gray">That recipe is not in the catalog.</Text>
      <ThemeLink asChild>
        <Link to="/catalog">Back to catalog</Link>
      </ThemeLink>
    </Flex>
  );
}
