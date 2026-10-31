import { Button, Callout, Flex, Select } from "@radix-ui/themes";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { FormField } from "@/components/FormField";
import { IntegerInput } from "@/components/IntegerInput";
import { firstFieldError } from "@/components/firstFieldError";
import type { CatalogKit } from "@/db/catalog";
import type { Settings } from "@/db/schema";
import {
  cookProfileMessage,
  kitSettingKey,
  parseMastery,
  parseStat,
  resolveDefaultKit,
  type CookProfileDraft,
} from "@/domain/cooking/profile";

const statFields = [
  {
    name: "baseLevel",
    id: "cook-base-level",
    label: "Base level",
    hint: "0–999. A high-level cook starts at 99.",
    parse: (value: string) => parseStat(value, "Base level"),
  },
  {
    name: "dex",
    id: "cook-dex",
    label: "DEX",
    hint: "0–999.",
    parse: (value: string) => parseStat(value, "DEX"),
  },
  {
    name: "luk",
    id: "cook-luk",
    label: "LUK",
    hint: "0–999. Under 101 lowers the rate. Over 101 raises it.",
    parse: (value: string) => parseStat(value, "LUK"),
  },
  {
    name: "mastery",
    id: "cook-mastery",
    label: "Mastery",
    hint: "0–1999.",
    parse: (value: string) => parseMastery(value),
  },
] as const;

export function CookProfileForm({
  kits,
  settings,
  onSave,
}: {
  kits: CatalogKit[];
  settings: Settings;
  onSave: (draft: CookProfileDraft) => Promise<void>;
}) {
  const savedKit = resolveDefaultKit(kits, settings.defaultKitKey);
  const form = useForm({
    defaultValues: {
      baseLevel: String(settings.baseLevel),
      dex: String(settings.dex),
      luk: String(settings.luk),
      mastery: String(settings.mastery),
      defaultKitKey: savedKit ? kitSettingKey(savedKit) : "",
    },
    onSubmit: async ({ value }) => {
      try {
        await onSave({
          baseLevel: parseStat(value.baseLevel, "Base level"),
          dex: parseStat(value.dex, "DEX"),
          luk: parseStat(value.luk, "LUK"),
          mastery: parseMastery(value.mastery),
          defaultKitKey: value.defaultKitKey,
        });
        toast.success("Saved the cook profile.");
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "Could not save the cook profile.");
      }
    },
  });

  return (
    <Flex asChild direction="column" gap="4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <Flex gap="3" wrap="wrap">
          {statFields.map((fieldDef) => (
            <form.Field
              key={fieldDef.name}
              name={fieldDef.name}
              validators={{
                onChange: ({ value }) => cookProfileMessage(() => fieldDef.parse(value)),
                onSubmit: ({ value }) => cookProfileMessage(() => fieldDef.parse(value)),
              }}
            >
              {(field) => (
                <FormField
                  id={fieldDef.id}
                  label={fieldDef.label}
                  hint={fieldDef.hint}
                  error={firstFieldError(field.state.meta.errors)}
                >
                  <IntegerInput
                    id={fieldDef.id}
                    ariaLabel={fieldDef.label}
                    value={field.state.value}
                    width="8rem"
                    onBlur={field.handleBlur}
                    onChange={field.handleChange}
                  />
                </FormField>
              )}
            </form.Field>
          ))}
        </Flex>
        {kits.length > 0 ? (
          <form.Field
            name="defaultKitKey"
            validators={{
              onChange: ({ value }) =>
                resolveDefaultKit(kits, value) ? undefined : "Choose a cooking kit.",
              onSubmit: ({ value }) =>
                resolveDefaultKit(kits, value) ? undefined : "Choose a cooking kit.",
            }}
          >
            {(field) => (
              <FormField
                label="Default kit"
                hint="Recipe pages use this kit for the profile rates. Every available kit is still listed on the dish."
                error={firstFieldError(field.state.meta.errors)}
              >
                <Select.Root
                  value={field.state.value}
                  onValueChange={(value) => {
                    field.handleChange(value);
                  }}
                >
                  <Select.Trigger aria-label="Default kit" placeholder="Choose a kit" />
                  <Select.Content>
                    {kits.map((kit) => (
                      <Select.Item key={kit.id} value={kitSettingKey(kit)}>
                        {kit.name}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </FormField>
            )}
          </form.Field>
        ) : (
          <Callout.Root color="gray" variant="surface">
            <Callout.Text>Unarchive a cooking kit before choosing a default.</Callout.Text>
          </Callout.Root>
        )}
        {kits.length > 0 && !savedKit ? (
          <Callout.Root color="gray" variant="surface">
            <Callout.Text>
              The saved default kit is archived or missing. Choose a kit and save.
            </Callout.Text>
          </Callout.Root>
        ) : null}
        <form.Subscribe
          selector={(state) => ({
            isSubmitting: state.isSubmitting,
            kitKey: state.values.defaultKitKey,
          })}
        >
          {(state) => (
            <Flex>
              <Button
                type="submit"
                disabled={state.isSubmitting || !resolveDefaultKit(kits, state.kitKey)}
                loading={state.isSubmitting}
              >
                Save cook profile
              </Button>
            </Flex>
          )}
        </form.Subscribe>
      </form>
    </Flex>
  );
}
