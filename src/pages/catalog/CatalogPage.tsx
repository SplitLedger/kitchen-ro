import { Button, Flex, Heading, Text } from "@radix-ui/themes";
import { Link, getRouteApi } from "@tanstack/react-router";
import { KitGrid } from "@/pages/catalog/KitGrid";
import { KitSection } from "@/pages/catalog/KitSection";
import { LevelBox } from "@/pages/catalog/LevelBox";
import { groupByLevel } from "@/pages/catalog/groupByLevel";

const routeApi = getRouteApi("/catalog/");

export function CatalogPage() {
  const { dishes, kits } = routeApi.useLoaderData();
  const activeDishes = dishes.filter((dish) => !dish.archived);
  const archivedDishes = dishes.filter((dish) => dish.archived);
  const activeKits = kits.filter((kit) => !kit.archived);
  const archivedKits = kits.filter((kit) => kit.archived);
  const levels = groupByLevel(activeDishes);
  const archivedLevels = groupByLevel(archivedDishes);

  return (
    <Flex direction="column" gap="6">
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Flex direction="column" gap="2">
          <Heading as="h1" size="6">
            Catalog
          </Heading>
          <Text as="p" color="gray">
            Dishes are grouped by level. A kit is consumed once per attempt.
          </Text>
        </Flex>
      </Flex>
      <KitSection
        emptyLabel={
          archivedKits.length > 0
            ? "Every kit is archived. Unarchive one to show it here."
            : "No cooking kits are in the catalog."
        }
        kits={activeKits}
      />
      <Flex direction="column" gap="3">
        <Flex align="center" justify="between" gap="3" wrap="wrap">
          <Heading as="h2" size="4">
            Dishes
          </Heading>
          <Button asChild variant="soft">
            <Link to="/catalog/new">New dish</Link>
          </Button>
        </Flex>
        {levels.length === 0 ? (
          <Text color="gray">
            {archivedLevels.length > 0
              ? "Every dish is archived. Unarchive one to show it here."
              : "No dishes are in the catalog."}
          </Text>
        ) : (
          levels.map((group) => <LevelBox key={group.level} group={group} />)
        )}
      </Flex>
      {archivedKits.length > 0 || archivedLevels.length > 0 ? (
        <Flex direction="column" gap="3">
          <Flex direction="column" gap="1">
            <Heading as="h2" size="4">
              Archived
            </Heading>
            <Text color="gray" size="2">
              These stay out of the lists above until you unarchive them.
            </Text>
          </Flex>
          {archivedKits.length > 0 ? <KitGrid kits={archivedKits} /> : null}
          {archivedLevels.map((group) => (
            <LevelBox key={`archived-${group.level}`} group={group} />
          ))}
        </Flex>
      ) : null}
    </Flex>
  );
}
