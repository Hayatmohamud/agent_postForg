import { Geist, Geist_Mono, Lora } from "next/font/google";

/**
 * PostForge type system (DESIGN_PROMPT.md section 4):
 * - UI sans:  Geist        — the modern grotesque used for all interface chrome.
 * - Editorial serif: Lora  — used only for rendered post body copy, so a
 *   finished post reads like a real article rather than app UI.
 * - Mono: Geist Mono       — source URLs, model names, run ids, other
 *   technical/machine-generated labels.
 *
 * All three are real Google fonts loaded via next/font/google (self-hosted,
 * zero layout shift, no external network request at runtime).
 */
export const fontSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const fontMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const fontEditorial = Lora({
  variable: "--font-editorial",
  subsets: ["latin"],
  display: "swap",
});

export const fontVariables = `${fontSans.variable} ${fontMono.variable} ${fontEditorial.variable}`;
