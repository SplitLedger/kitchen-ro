import { Flex, Heading, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { useAppState } from "@/providers/AppStateProvider";
import type { PlanningMode, Settings, ThemeName } from "@/db/schema";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

const fields: Array<{ label: string; value: (settings: Settings) => string }> = [
  { label: "Row", value: (settings) => String(settings.id) },
  { label: "Theme", value: (settings) => themeLabel(settings.theme) },
  { label: "Base level", value: (settings) => String(settings.baseLevel) },
  { label: "DEX", value: (settings) => String(settings.dex) },
  { label: "LUK", value: (settings) => String(settings.luk) },
  { label: "Mastery", value: (settings) => String(settings.mastery) },
  { label: "Default kit", value: (settings) => settings.defaultKitKey },
  { label: "Margin", value: (settings) => `${settings.marginPercent}%` },
  { label: "Currency", value: (settings) => settings.currencyLabel },
  { label: "Planning mode", value: (settings) => planningModeLabel(settings.planningMode) },
];

function themeLabel(theme: ThemeName): string {
  return theme === "dark" ? "Dark" : "Light";
}

function planningModeLabel(mode: PlanningMode): string {
  return mode === "expected" ? "Expected" : "Conservative";
}

function SettingsPage() {
  const { settings } = useAppState();

  return (
    <Flex direction="column" gap="4" maxWidth="40rem">
      <Flex direction="column" gap="2">
        <Heading as="h1" size="6">
          Settings
        </Heading>
        <Text as="p" color="gray">
          Cook profile editing is not available yet. This settings row is created the first time the
          app opens.
        </Text>
      </Flex>
      <Flex direction="column" gap="2">
        {fields.map((field) => (
          <Flex key={field.label} justify="between" gap="4">
            <Text color="gray">{field.label}</Text>
            <Text>{field.value(settings)}</Text>
          </Flex>
        ))}
      </Flex>
    </Flex>
  );
}
