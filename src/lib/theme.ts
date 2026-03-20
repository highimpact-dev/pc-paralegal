import { createContext, useContext } from "react";

export type ThemePreference = "light" | "dark" | "auto";
export type ResolvedTheme = "light" | "dark";

export interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  preference: "auto",
  resolved: "light",
  setPreference: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function getStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem("pc-paralegal-theme");
    if (stored === "dark" || stored === "light" || stored === "auto") return stored;
  } catch {}
  return "auto";
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === "auto") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return pref;
}

export function applyTheme(resolved: ResolvedTheme) {
  // Explicitly add/remove rather than toggle for WKWebView compatibility
  if (resolved === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function savePreference(pref: ThemePreference) {
  localStorage.setItem("pc-paralegal-theme", pref);
}
