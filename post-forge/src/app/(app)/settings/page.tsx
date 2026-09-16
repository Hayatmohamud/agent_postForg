import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui";

/**
 * Placeholder for T15/settings scope. Real page shows profile, integration
 * status + test-connection, defaults, and a danger zone (per
 * DESIGN_PROMPT.md screen 10 and the "API keys are env-only" locked
 * decision in CLAUDE.md — this never becomes a key-entry form).
 */
export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-wide text-brand-600">Settings</p>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Placeholder route — the real settings screen lands later.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
        </CardHeader>
        <CardDescription>
          API keys are configured via environment variables only; this screen will show connection
          status and a test-connection action, never key entry.
        </CardDescription>
      </Card>
    </div>
  );
}
