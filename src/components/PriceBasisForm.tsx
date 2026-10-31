import { Flex, RadioGroup, Text } from "@radix-ui/themes";
import { useState } from "react";
import { toast } from "sonner";
import { isPriceBasis, priceBasisLabels } from "@/domain/inventory/prices";
import { useAppState } from "@/providers/AppStateProvider";

export function PriceBasisForm() {
  const { settings, updatePriceBasis } = useAppState();
  const [saving, setSaving] = useState(false);

  async function change(value: string) {
    if (!isPriceBasis(value) || value === settings.priceBasis) {
      return;
    }
    setSaving(true);
    try {
      await updatePriceBasis(value);
      toast.success("Saved the price basis.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not save the price basis.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Flex direction="column" gap="2">
      <Text size="2" weight="medium">
        Default price basis
      </Text>
      <RadioGroup.Root
        value={settings.priceBasis}
        disabled={saving}
        onValueChange={(value) => {
          void change(value);
        }}
      >
        <Flex direction="column" gap="2">
          <Flex align="center" gap="2">
            <RadioGroup.Item value="minimum" id="settings-price-minimum" />
            <Text as="label" htmlFor="settings-price-minimum" size="2">
              {priceBasisLabels.minimum} — lowest unit price still on hand
            </Text>
          </Flex>
          <Flex align="center" gap="2">
            <RadioGroup.Item value="average" id="settings-price-average" />
            <Text as="label" htmlFor="settings-price-average" size="2">
              {priceBasisLabels.average} — quantity-weighted average
            </Text>
          </Flex>
          <Flex align="center" gap="2">
            <RadioGroup.Item value="maximum" id="settings-price-maximum" />
            <Text as="label" htmlFor="settings-price-maximum" size="2">
              {priceBasisLabels.maximum} — highest unit price still on hand
            </Text>
          </Flex>
        </Flex>
      </RadioGroup.Root>
      <Text color="gray" size="1">
        New orders copy this basis. The sale uses that one number. Minimum and maximum stay visible
        as a range.
      </Text>
    </Flex>
  );
}
