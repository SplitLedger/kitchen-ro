import { Button, Flex, Heading, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import type { CatalogKit } from "@/db/catalog";
import { KitGrid } from "@/pages/catalog/KitGrid";

export function KitSection({
  kits,
  emptyLabel = "No cooking kits are in the catalog.",
}: {
  kits: CatalogKit[];
  emptyLabel?: string;
}) {
  return (
    <Flex direction="column" gap="3">
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Heading as="h2" size="4">
          Cooking kits
        </Heading>
        <Button asChild variant="soft">
          <Link to="/catalog/kits/new">New kit</Link>
        </Button>
      </Flex>
      {kits.length === 0 ? <Text color="gray">{emptyLabel}</Text> : <KitGrid kits={kits} />}
    </Flex>
  );
}
