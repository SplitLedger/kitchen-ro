import { createContext, useContext } from "react";
import type { AppDatabase } from "@/db/open";
import type { Settings, ThemeName } from "@/db/schema";

export type AppState = {
  database: AppDatabase;
  settings: Settings;
  setTheme: (theme: ThemeName) => Promise<void>;
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
