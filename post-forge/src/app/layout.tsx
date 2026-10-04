import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import { noFlashThemeScript } from "@/lib/theme";
import { SessionProviderWrapper } from "@/components/auth/SessionProviderWrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "PostForge",
  description: "Autonomous multi-agent content generator.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${fontVariables}`}
      // data-theme is set by the no-flash script below, before React hydrates —
      // intentionally out of React's control, so it must not be treated as a mismatch.
      suppressHydrationWarning
    >
      <head>
        {/* Sets data-theme before hydration so there's no flash of the wrong
            theme; kept in sync with src/lib/theme.ts's applyTheme/resolveTheme. */}
        <script dangerouslySetInnerHTML={{ __html: noFlashThemeScript }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
