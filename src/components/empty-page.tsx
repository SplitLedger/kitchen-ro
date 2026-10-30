import { Flex, Heading, Text } from "@radix-ui/themes";

export function EmptyPage({ title, description }: { title: string; description: string }) {
  return (
    <Flex direction="column" gap="2" maxWidth="40rem">
      <Heading as="h1" size="6">
        {title}
      </Heading>
      <Text as="p" color="gray">
        {description}
      </Text>
    </Flex>
  );
}
