import { createContext, useContext } from "react";
import type { CookProfileDraft } from "@/domain/cooking/profile";
import type { PriceBasis } from "@/domain/inventory/prices";
import type { PricingSettingsDraft } from "@/domain/pricing/cost";
import type { AppDatabase } from "@/db/open";
import type { PlanningMode, Settings, ThemeName } from "@/db/schema";

export type AppState = {
  database: AppDatabase;
  settings: Settings;
  setTheme: (theme: ThemeName) => Promise<void>;
  updateCookProfile: (draft: CookProfileDraft) => Promise<void>;
  updatePricingSettings: (draft: PricingSettingsDraft) => Promise<void>;
  updatePlanningMode: (planningMode: PlanningMode) => Promise<void>;
  updatePriceBasis: (priceBasis: PriceBasis) => Promise<void>;
};

const AppStateContext = createContext<AppState | null>(null);

export const AppStateProvider = AppStateContext.Provider;

export function useAppState(): AppState {
  const state = useContext(AppStateContext);
  if (!state) {
    throw new Error("App state is unavailable.");
  }
  return state;
}
