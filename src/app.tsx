import { Button, Flex, Heading, Text, Theme } from "@radix-ui/themes";
import { RouterProvider } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { AppStateProvider } from "@/providers/AppStateProvider";
import { openAppDatabase, type AppDatabase } from "@/db/open";
import type { CookProfileDraft } from "@/domain/cooking/profile";
import type { PriceBasis } from "@/domain/inventory/prices";
import type { PricingSettingsDraft } from "@/domain/pricing/cost";
import type { PlanningMode, Settings, ThemeName } from "@/db/schema";
import { router } from "@/router";

type ReadyState = {
  database: AppDatabase;
  settings: Settings;
};

export function App() {
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState<ReadyState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    openAppDatabase()
      .then(async (database) => {
        const settings = await database.readSettings();
        if (!cancelled) {
          setReady({ database, settings });
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setReady(null);
          setError(caught instanceof Error ? caught.message : "Could not open the database.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (!ready) {
    return (
      <Theme accentColor="orange" appearance="dark" grayColor="slate" radius="medium">
        <Flex
          align="center"
          direction="column"
          gap="3"
          justify="center"
          style={{ minHeight: "100vh" }}
        >
          <Heading as="h1" size="5">
            Kitchen RO
          </Heading>
          <Text color="gray">{error ?? "Opening the database…"}</Text>
          {error ? (
            <Button
              onClick={() => {
                setError(null);
                setAttempt((current) => current + 1);
              }}
            >
              Try again
            </Button>
          ) : null}
        </Flex>
      </Theme>
    );
  }

  const database = ready.database;

  async function setTheme(theme: ThemeName) {
    const settings = await database.updateTheme(theme);
    setReady({ database, settings });
  }

  async function updateCookProfile(draft: CookProfileDraft) {
    const settings = await database.updateCookProfile(draft);
    setReady({ database, settings });
  }

  async function updatePricingSettings(draft: PricingSettingsDraft) {
    const settings = await database.updatePricingSettings(draft);
    setReady({ database, settings });
  }

  async function updatePlanningMode(planningMode: PlanningMode) {
    const settings = await database.updatePlanningMode(planningMode);
    setReady({ database, settings });
  }

  async function updatePriceBasis(priceBasis: PriceBasis) {
    const settings = await database.updatePriceBasis(priceBasis);
    setReady({ database, settings });
  }

  return (
    <Theme
      accentColor="orange"
      appearance={ready.settings.theme}
      grayColor="slate"
      radius="medium"
      style={{ minHeight: "100vh" }}
    >
      <AppStateProvider
        value={{
          database: ready.database,
          settings: ready.settings,
          setTheme,
          updateCookProfile,
          updatePricingSettings,
          updatePlanningMode,
          updatePriceBasis,
        }}
      >
        <RouterProvider router={router} />
        <Toaster
          className="no-print"
          position="bottom-right"
          richColors
          theme={ready.settings.theme}
        />
      </AppStateProvider>
    </Theme>
  );
}
