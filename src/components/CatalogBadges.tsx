import { Badge, Flex } from "@radix-ui/themes";

export function CatalogBadges({
  custom = false,
  edited = false,
  archived = false,
}: {
  custom?: boolean;
  edited?: boolean;
  archived?: boolean;
}) {
  if (!custom && !edited && !archived) {
    return null;
  }
  return (
    <Flex gap="1" wrap="wrap">
      {custom ? (
        <Badge color="orange" variant="soft">
          Custom
        </Badge>
      ) : null}
      {edited ? (
        <Badge color="amber" variant="soft">
          Edited
        </Badge>
      ) : null}
      {archived ? (
        <Badge color="gray" variant="soft">
          Archived
        </Badge>
      ) : null}
    </Flex>
  );
}
