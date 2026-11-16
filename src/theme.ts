import { useSyncExternalStore } from "react";
import { THEME_COLORS, THEME_KEY, type Theme } from "./theme-boot";

export type { Theme };

/**
 * Learning themes. Paper is the default, matching Structura's Warm Paper.
 * Blueprint and Chalkboard are darker, for evening study. The choice is a
 * per-device convenience in localStorage. The script in layout.tsx applies it
 * before the first paint, so there is no flash.
 */

export const THEMES: { id: Theme; name: string; blurb: string; dark: boolean; swatch: [string, string] }[] = [
  { id: "paper", name: "Paper", blurb: "Warm notebook paper, like Structura", dark: false, swatch: ["#f7f5ef", "#2f6f9f"] },
  { id: "blueprint", name: "Blueprint", blurb: "Navy grid, like a schema drawing", dark: true, swatch: ["#0f2741", "#7cc4f0"] },
  { id: "chalkboard", name: "Chalkboard", blurb: "Slate green with chalk colours", dark: true, swatch: ["#1f2b27", "#f2d879"] },
];

const isTheme = (v: unknown): v is Theme => THEMES.some((t) => t.id === v);

const listeners = new Set<() => void>();
let current: Theme = "paper";
if (typeof document !== "undefined") {
  const set = document.documentElement.dataset.theme;
  current = isTheme(set) ? set : "paper";
}

export function setTheme(t: Theme) {
  current = t;
  try {
    if (t === "paper") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {
    /* private mode: still applies for this visit */
  }
  const root = document.documentElement;
  root.dataset.theme = t;
  root.style.colorScheme = THEMES.find((x) => x.id === t)!.dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[t]);
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const useTheme = () => useSyncExternalStore(subscribe, () => current, () => "paper" as Theme);
export const isDark = (t: Theme) => THEMES.find((x) => x.id === t)!.dark;
