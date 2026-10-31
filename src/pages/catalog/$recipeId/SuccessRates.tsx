import { Callout, Card, Flex, Heading, Link as ThemeLink, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import type { CatalogKit } from "@/db/catalog";
import type { Settings } from "@/db/schema";
import { kitSettingKey, resolveDefaultKit } from "@/domain/cooking/profile";
import { cookingSuccessRates, formatSuccessRate, isCertainSuccess } from "@/domain/cooking/success";
import { Fact } from "@/pages/catalog/$recipeId/Fact";

export function SuccessRates({
  foodLevel,
  ingredientRowCount,
  kits,
  settings,
}: {
  foodLevel: number;
  ingredientRowCount: number;
  kits: readonly CatalogKit[];
  settings: Settings;
}) {
  const profile = {
    baseLevel: settings.baseLevel,
    dex: settings.dex,
    luk: settings.luk,
    mastery: settings.mastery,
  };
  const defaultKit = resolveDefaultKit(kits, settings.defaultKitKey);
  const rates = defaultKit
    ? cookingSuccessRates(profile, defaultKit, foodLevel, ingredientRowCount)
    : null;
  const rowLabel = ingredientRowCount === 1 ? "row" : "rows";

  return (
    <Flex direction="column" gap="3">
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Heading as="h2" size="4">
          Success rates
        </Heading>
        <ThemeLink asChild>
          <Link to="/settings">Edit cook profile</Link>
        </ThemeLink>
      </Flex>
      <Text color="gray" size="2">
        Minimum, average, and maximum for this profile. The ingredient penalty counts{" "}
        {ingredientRowCount} {rowLabel}. Quantities and the cookbook are left out of that count.
      </Text>
      <Flex gap="5" wrap="wrap">
        <Fact label="Base level" value={String(profile.baseLevel)} />
        <Fact label="DEX" value={String(profile.dex)} />
        <Fact label="LUK" value={String(profile.luk)} />
        <Fact label="Mastery" value={String(profile.mastery)} />
        <Fact label="Default kit" value={defaultKit?.name ?? "Choose a kit in Settings"} />
      </Flex>
      {defaultKit && rates ? (
        <Card size="2" variant="surface">
          <Flex direction="column" gap="3">
            <Heading as="h3" size="3">
              {defaultKit.name}
            </Heading>
            <Flex gap="5" wrap="wrap">
              <RateFigure label="Minimum" value={formatSuccessRate(rates.minBp)} />
              <RateFigure label="Average" value={formatSuccessRate(rates.avgBp)} />
              <RateFigure label="Maximum" value={formatSuccessRate(rates.maxBp)} />
            </Flex>
            {isCertainSuccess(defaultKit) ? (
              <Text color="gray" size="2">
                This kit always succeeds, so minimum, average, and maximum are 100%.
              </Text>
            ) : null}
          </Flex>
        </Card>
      ) : (
        <Callout.Root color="gray" variant="surface">
          <Callout.Text>
            Choose a default kit in Settings to see this dish at the profile rates.
          </Callout.Text>
        </Callout.Root>
      )}
    </Flex>
  );
}

export function kitRates(
  kit: CatalogKit,
  settings: Settings,
  foodLevel: number,
  ingredientRowCount: number,
) {
  return cookingSuccessRates(
    {
      baseLevel: settings.baseLevel,
      dex: settings.dex,
      luk: settings.luk,
      mastery: settings.mastery,
    },
    kit,
    foodLevel,
    ingredientRowCount,
  );
}

export function isDefaultKit(kit: CatalogKit, defaultKitKey: string): boolean {
  return kitSettingKey(kit) === defaultKitKey;
}

function RateFigure({ label, value }: { label: string; value: string }) {
  return (
    <Flex direction="column" gap="1">
      <Text color="gray" size="1">
        {label}
      </Text>
      <Text size="5" weight="medium" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Text>
    </Flex>
  );
}
