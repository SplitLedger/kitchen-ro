import { Text } from "@radix-ui/themes";

export function PagePending({ label }: { label: string }) {
  return <Text color="gray">{label}</Text>;
}

export function pagePending(label: string) {
  return function Pending() {
    return <PagePending label={label} />;
  };
}
