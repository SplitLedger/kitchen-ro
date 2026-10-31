import { Text } from "@radix-ui/themes";

export function PageError({ error, fallback }: { error: unknown; fallback: string }) {
  const message = error instanceof Error ? error.message : fallback;
  return <Text color="red">{message}</Text>;
}

export function pageError(fallback: string) {
  return function ErrorComponent({ error }: { error: unknown }) {
    return <PageError error={error} fallback={fallback} />;
  };
}
