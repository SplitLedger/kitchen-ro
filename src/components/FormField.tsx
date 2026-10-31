import { Flex, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";

export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <Flex direction="column" gap="1" flexGrow="1">
      <Text as="label" htmlFor={id} size="2" weight="medium">
        {label}
      </Text>
      {children}
      {hint ? (
        <Text color="gray" size="1">
          {hint}
        </Text>
      ) : null}
      {error ? (
        <Text color="red" size="1">
          {error}
        </Text>
      ) : null}
    </Flex>
  );
}
