export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "postforge-theme";

/**
 * Inline, string-serialized version of `resolveTheme`/`applyTheme` below,
 * executed by a blocking <script> in the <head> (see layout.tsx) before
 * React hydrates — this is what avoids a flash of the wrong theme. Keep the
 * logic here and the inline script in sync if either changes.
 */
export const noFlashThemeScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var s=localStorage.getItem(k);var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){}})();`;

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return preference;
}

export function applyTheme(preference: ThemePreference): void {
  if (typeof window === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolveTheme(preference));
  if (preference === "system") {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
  } else {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  }
}
