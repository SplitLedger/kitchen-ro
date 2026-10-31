import { Flex, Link as ThemeLink, Table, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import { CatalogBadges } from "@/components/CatalogBadges";
import { formatReferencePrice } from "@/components/formatReferencePrice";
import type { CatalogIngredient } from "@/db/catalog";
import { ingredientDiffersFromSeed } from "@/domain/catalog/edit";

export function IngredientTable({
  ingredients,
  currencyLabel,
}: {
  ingredients: CatalogIngredient[];
  currencyLabel: string;
}) {
  return (
    <Table.Root variant="surface">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>Ingredient</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>NPC reference</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {ingredients.map((ingredient) => (
          <Table.Row key={ingredient.id}>
            <Table.Cell>
              <Flex align="center" gap="2" wrap="wrap">
                <ThemeLink asChild weight="medium">
                  <Link
                    params={{ ingredientId: String(ingredient.id) }}
                    to="/ingredients/$ingredientId"
                  >
                    {ingredient.name}
                  </Link>
                </ThemeLink>
                <CatalogBadges
                  archived={ingredient.archived}
                  custom={ingredient.origin === "custom"}
                  edited={ingredientDiffersFromSeed(ingredient)}
                />
              </Flex>
            </Table.Cell>
            <Table.Cell>
              <Text color="gray">
                {formatReferencePrice(ingredient.referencePrice, currencyLabel)}
              </Text>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
