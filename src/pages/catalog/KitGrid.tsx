import { Badge, Card, Flex, Grid, Link as ThemeLink, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import { CatalogBadges } from "@/components/CatalogBadges";
import type { CatalogKit } from "@/db/catalog";
import { kitDiffersFromSeed } from "@/domain/catalog/edit";

export function KitGrid({ kits }: { kits: CatalogKit[] }) {
  return (
    <Grid columns={{ initial: "1", xs: "2", md: "3", xl: "5" }} gap="3">
      {kits.map((kit) => (
        <Card key={kit.id} size="2" variant="surface">
          <Flex direction="column" gap="2" height="100%">
            <ThemeLink asChild weight="medium">
              <Link params={{ kitId: String(kit.id) }} to="/catalog/kits/$kitId">
                {kit.name}
              </Link>
            </ThemeLink>
            <Text color="gray" size="2">
              Produce value {kit.produceValue}
            </Text>
            <Flex align="center" gap="2" wrap="wrap">
              {kit.alwaysSuccess ? (
                <Badge color="green" variant="soft">
                  Always succeeds
                </Badge>
              ) : null}
              <CatalogBadges
                archived={kit.archived}
                custom={kit.origin === "custom"}
                edited={kitDiffersFromSeed(kit)}
              />
            </Flex>
          </Flex>
        </Card>
      ))}
    </Grid>
  );
}
