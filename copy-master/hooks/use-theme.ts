"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useStoredString } from "@/hooks/use-stored-string";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "copy-master:theme";

/**
 * Applies a saved theme before first paint, so a dark-mode visitor never gets
 * a white flash. Inlined into the document head by the root layout.
 */
export const THEME_SCRIPT = `
try {
  var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
  if (stored === "light" || stored === "dark") {
    document.documentElement.dataset.theme = stored;
  }
} catch (error) {}
`;

const QUERY = "(prefers-color-scheme: dark)";

function subscribeToSystem(listener: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

function getSystemTheme(): Theme {
  return window.matchMedia(QUERY).matches ? "dark" : "light";
}

function getServerTheme(): Theme {
  return "light";
}

export interface UseThemeResult {
  /** What is actually on screen: the saved choice, else the OS preference. */
  theme: Theme;
  /** True when the user has picked a theme rather than following the OS. */
  isExplicit: boolean;
  toggle: () => void;
}

export function useTheme(): UseThemeResult {
  const [stored, setStored] = useStoredString(THEME_STORAGE_KEY, "");
  const system = useSyncExternalStore(
    subscribeToSystem,
    getSystemTheme,
    getServerTheme,
  );

  const isExplicit = stored === "light" || stored === "dark";
  const theme: Theme = isExplicit ? (stored as Theme) : system;

  /*
   * Mirror an explicit choice onto the document so the CSS can pick it up.
   * This only ever sets the attribute, never clears it: the inline script has
   * already set it correctly on load, and clearing it mid-hydration would
   * flash the OS theme at someone who chose the opposite one.
   */
  useEffect(() => {
    if (isExplicit) {
      document.documentElement.dataset.theme = stored;
    }
  }, [isExplicit, stored]);

  const toggle = useCallback(() => {
    setStored(theme === "dark" ? "light" : "dark");
  }, [setStored, theme]);

  return { theme, isExplicit, toggle };
}
