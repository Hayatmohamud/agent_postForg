import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui";
import { AppShell } from "@/components/AppShell";

/**
 * Shell for every authed route (T10-T15 mount inside this). Auth is a
 * cosmetic stub (T09) — this layout does not gate on a session, per the
 * locked decision in CLAUDE.md. Mounts the toast provider app-wide; the
 * error boundary for this segment lives in `./error.tsx` (keeps this shell
 * visible around a friendly failure message instead of blanking the page).
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AppShell>{children}</AppShell>
    </ToastProvider>
  );
}
