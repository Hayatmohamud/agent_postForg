"use client";

import { useEffect, useState } from "react";

/**
 * Tracks the user's `prefers-reduced-motion` preference on the client.
 * Returns `false` on first render (server + first paint) and updates once
 * mounted, so any consumer must treat the initial value as "unknown / off"
 * and must not rely on it for the very first frame's markup differing from
 * the server-rendered one (avoids hydration mismatches).
 *
 * Consumers doing JS-driven animation (timers, interval-based state cycling)
 * should branch on this and skip scheduling work entirely when true — the
 * global CSS reduced-motion override (src/app/globals.css) already collapses
 * CSS animation/transition durations, but a piece of UI that cycles state via
 * `setInterval` needs this hook to stop re-rendering altogether.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);

    const handleChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return reduced;
}
