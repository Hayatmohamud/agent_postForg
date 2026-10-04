"use client";

import { useTheme } from "@/hooks/useTheme";
import { MoonIcon, SunIcon } from "./icons";

/** Topbar quick toggle: flips between light/dark, always showing the icon for the theme you'd switch *to*. */
export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface text-gray-600 hover:bg-surface-2"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
