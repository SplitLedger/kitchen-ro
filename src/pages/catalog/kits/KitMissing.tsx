import { Flex, Heading, Link as ThemeLink } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";

export function KitMissing() {
  return (
    <Flex direction="column" gap="3">
      <Heading as="h1" size="6">
        Kit not found
      </Heading>
      <ThemeLink asChild>
        <Link to="/catalog">Back to catalog</Link>
      </ThemeLink>
    </Flex>
  );
}
