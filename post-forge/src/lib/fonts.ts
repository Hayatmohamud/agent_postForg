import { Instrument_Sans, JetBrains_Mono, Newsreader } from "next/font/google";

/**
 * PostForge type system (redesign, superseding the original DESIGN_PROMPT.md
 * section 4 choices — see CLAUDE.md's "locked decisions" note):
 * - UI sans:  Instrument Sans — all interface chrome.
 * - Editorial serif: Newsreader — rendered post body copy, landing hero
 *   emphasis, testimonial quotes, poster headlines.
 * - Mono: JetBrains Mono      — source URLs, model names, run ids, other
 *   technical/machine-generated labels.
 *
 * All three are real Google fonts loaded via next/font/google (self-hosted,
 * zero layout shift, no external network request at runtime).
 */
export const fontSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

export const fontMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const fontEditorial = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
});

export const fontVariables = `${fontSans.variable} ${fontMono.variable} ${fontEditorial.variable}`;
