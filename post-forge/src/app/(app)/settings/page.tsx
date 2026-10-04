"use client";

import { useSession } from "next-auth/react";
import { Avatar, Card, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import type { ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/cn";

/**
 * Settings screen: just Profile (real Google/GitHub identity from the
 * Auth.js session — read-only here, since the name/email are owned by the
 * OAuth provider, not this app) and Appearance (theme preference,
 * src/lib/theme.ts + useTheme). Generation defaults, Integrations, and
 * Danger zone were removed from the UI on request; their API routes
 * (`/api/settings`, `/api/settings/test`, `/api/settings/posts`) are
 * untouched, just unreachable from here for now.
 */

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function ThemeSwatch({ preference }: { preference: ThemePreference }) {
  const dark = preference === "dark";
  return (
    <span
      className={cn(
        "flex h-9 w-full overflow-hidden rounded-[var(--radius-sm)] border",
        dark ? "border-[#1e2724]" : "border-[#e5eae7]",
      )}
      aria-hidden="true"
    >
      {preference === "system" ? (
        <>
          <span className="h-full w-1/2 bg-[#ffffff]" />
          <span className="h-full w-1/2 bg-[#080b0a]" />
        </>
      ) : (
        <span className={cn("h-full w-full", dark ? "bg-[#080b0a]" : "bg-[#ffffff]")} />
      )}
    </span>
  );
}

export default function SettingsPage() {
  const { preference, setTheme } = useTheme();
  const { data: session } = useSession();
  const name = session?.user?.name ?? "Account";
  const email = session?.user?.email ?? "";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-wide text-brand-600">Settings</p>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Manage your profile and appearance.</p>
      </header>

      {/* Profile — read-only, sourced from the real Google/GitHub session. */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <div className="flex items-center gap-4">
          <Avatar name={name} src={session?.user?.image ?? undefined} size="lg" />
          <div>
            <p className="text-sm font-medium text-gray-900">{name}</p>
            <p className="text-sm text-gray-500">{email}</p>
          </div>
        </div>
      </Card>

      {/* Appearance — theme preference. */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardDescription>Choose how PostForge looks on this device.</CardDescription>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              aria-pressed={preference === opt.value}
              className={cn(
                "flex flex-col gap-2 rounded-[var(--radius-lg)] border p-2.5 text-left transition-colors",
                preference === opt.value
                  ? "border-brand-600 bg-brand-50"
                  : "border-border-strong bg-surface hover:border-brand-300",
              )}
            >
              <ThemeSwatch preference={opt.value} />
              <span className="text-sm font-medium text-gray-900">{opt.label}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
