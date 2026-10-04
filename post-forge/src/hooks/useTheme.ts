"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyTheme,
  getStoredThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

/**
 * Client-side theme state, backing the Topbar's quick toggle and the
 * Settings > Appearance picker (src/lib/theme.ts). `preference` is what the
 * user chose (light/dark/system); `resolvedTheme` is what's actually
 * painted, tracking the OS setting live when `preference === "system"`.
 *
 * Initial render always reports "light"/"system" (matching the server) to
 * avoid a hydration mismatch — the real value syncs in an effect, same
 * pattern as usePrefersReducedMotion. The no-flash inline script in
 * layout.tsx already paints the correct theme before hydration; this hook
 * is for reactive UI (toggle icon, settings radio state), not the paint.
 */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const stored = getStoredThemePreference();
    setPreference(stored);
    setResolvedTheme(resolveTheme(stored));

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      setPreference((current) => {
        if (current === "system") setResolvedTheme(resolveTheme("system"));
        return current;
      });
    };
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    applyTheme(next);
    setPreference(next);
    setResolvedTheme(resolveTheme(next));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  return { preference, resolvedTheme, setTheme, toggleTheme };
}
