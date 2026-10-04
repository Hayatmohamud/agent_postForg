"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/** Thin client wrapper so the (server) root layout can provide the session context. */
export function SessionProviderWrapper({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
