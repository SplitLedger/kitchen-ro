import { Flex, Text } from "@radix-ui/themes";

export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Flex direction="column" gap="1">
      <Text color="gray" size="1">
        {label}
      </Text>
      <Text>{value}</Text>
    </Flex>
  );
}
