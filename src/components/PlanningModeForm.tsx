import { Flex, RadioGroup, Text } from "@radix-ui/themes";
import { useState } from "react";
import { toast } from "sonner";
import { isOrderPlanningMode, planningModeLabels } from "@/domain/orders/plan";
import { useAppState } from "@/providers/AppStateProvider";

export function PlanningModeForm() {
  const { settings, updatePlanningMode } = useAppState();
  const [saving, setSaving] = useState(false);

  async function change(value: string) {
    if (!isOrderPlanningMode(value) || value === settings.planningMode) {
      return;
    }
    setSaving(true);
    try {
      await updatePlanningMode(value);
      toast.success("Saved the planning mode.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not save the planning mode.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Flex direction="column" gap="2">
      <Text size="2" weight="medium">
        Default planning mode
      </Text>
      <RadioGroup.Root
        value={settings.planningMode}
        disabled={saving}
        onValueChange={(value) => {
          void change(value);
        }}
      >
        <Flex direction="column" gap="2">
          <Flex align="center" gap="2">
            <RadioGroup.Item value="expected" id="settings-expected" />
            <Text as="label" htmlFor="settings-expected" size="2">
              {planningModeLabels.expected} — average success
            </Text>
          </Flex>
          <Flex align="center" gap="2">
            <RadioGroup.Item value="conservative" id="settings-conservative" />
            <Text as="label" htmlFor="settings-conservative" size="2">
              {planningModeLabels.conservative} — minimum success
            </Text>
          </Flex>
        </Flex>
      </RadioGroup.Root>
      <Text color="gray" size="1">
        New orders start in this mode. An order keeps the mode you set on it.
      </Text>
    </Flex>
  );
}
