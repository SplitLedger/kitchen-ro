import { Card, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { CookProfileForm } from "@/components/CookProfileForm";
import { PlanningModeForm } from "@/components/PlanningModeForm";
import { PriceBasisForm } from "@/components/PriceBasisForm";
import { PricingSettingsForm } from "@/components/PricingSettingsForm";
import { Fact } from "@/pages/catalog/$recipeId/Fact";
import { DatabaseBackup } from "@/pages/settings/DatabaseBackup";
import { useAppState } from "@/providers/AppStateProvider";

const routeApi = getRouteApi("/settings");

export function SettingsPage() {
  const { kits } = routeApi.useLoaderData();
  const { settings, updateCookProfile, updatePricingSettings } = useAppState();
  const router = useRouter();

  return (
    <Flex direction="column" gap="5">
      <Flex direction="column" gap="2">
        <Heading as="h1" size="6">
          Settings
        </Heading>
        <Text as="p" color="gray">
          Each card saves on its own.
        </Text>
      </Flex>
      <Grid columns={{ initial: "1", md: "2", xl: "3" }} gap="4">
        <SettingsCard
          title="Cook profile"
          description="Success rates use this cook profile. Saving it updates every recipe."
        >
          <CookProfileForm
            kits={kits}
            settings={settings}
            onSave={async (draft) => {
              await updateCookProfile(draft);
              await router.invalidate();
            }}
          />
        </SettingsCard>
        <SettingsCard
          title="New orders"
          description="The planning mode chooses the success rate a new order uses. Expected is the average. Conservative is the minimum. Choosing one saves it."
        >
          <PlanningModeForm />
        </SettingsCard>
        <SettingsCard
          title="Unit price"
          description="Lot prices still on hand supply the unit price. The basis chooses the lowest, the quantity-weighted average, or the highest. Choosing one saves it."
        >
          <PriceBasisForm />
        </SettingsCard>
        <SettingsCard
          title="Margin and currency"
          description="Margin is added to the cost of one success, then rounded up to a whole unit of this currency. Saving here updates the margin and the currency label."
        >
          <PricingSettingsForm
            settings={settings}
            onSave={async (draft) => {
              await updatePricingSettings(draft);
              await router.invalidate();
            }}
          />
        </SettingsCard>
        <SettingsCard
          title="Theme"
          description="The button in the header switches light and dark. That choice saves on its own."
        >
          <Fact label="Current theme" value={settings.theme === "dark" ? "Dark" : "Light"} />
        </SettingsCard>
        <Card size="2" style={{ height: "100%" }} variant="surface">
          <DatabaseBackup />
        </Card>
      </Grid>
    </Flex>
  );
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card size="2" style={{ height: "100%" }} variant="surface">
      <Flex direction="column" gap="4">
        <Flex direction="column" gap="2">
          <Heading as="h2" size="4">
            {title}
          </Heading>
          <Text as="p" color="gray">
            {description}
          </Text>
        </Flex>
        {children}
      </Flex>
    </Card>
  );
}
