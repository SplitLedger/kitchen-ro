import { Flex, Heading, Link as ThemeLink, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";

export function OrderMissing() {
  return (
    <Flex direction="column" gap="3">
      <Heading as="h1" size="6">
        Order not found
      </Heading>
      <Text color="gray">That order is not in the database.</Text>
      <ThemeLink asChild>
        <Link to="/orders">Back to orders</Link>
      </ThemeLink>
    </Flex>
  );
}
