import Link from "next/link";
import { AGENT_ORDER, AGENT_STAGES } from "@/components/pipeline";

/**
 * Shared chrome for the public auth screens (sign-in / sign-up): a
 * two-column split — the form on the left, a "live run" showcase pane on
 * the right reusing the canonical six-agent list (`src/components/pipeline/
 * agents.ts`) so it stays in sync with the real pipeline elsewhere in the
 * app. The showcase pane hides below `lg` (auth stays single-column on
 * mobile/tablet).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16">
        <Link href="/" className="mb-11 flex w-fit items-center gap-2.5">
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[var(--radius-sm)] bg-brand-600 text-white">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 3l6 3.5v7L10 17l-6-3.5v-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 10v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-text">PostForge</span>
        </Link>
        <div className="w-full max-w-sm">{children}</div>
      </div>

      <div className="hidden border-l border-border bg-bg-sub px-10 py-16 lg:flex lg:flex-col lg:justify-center lg:gap-6 xl:px-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-gray-500">
          Live run &middot; 6 agents
        </p>
        <div className="flex flex-col gap-4">
          {AGENT_ORDER.map((key) => {
            const stage = AGENT_STAGES[key];
            const Icon = stage.icon;
            return (
              <div key={key} className="flex items-center gap-3.5">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border"
                  style={{
                    borderColor: `var(--color-${stage.colorToken}-100)`,
                    backgroundColor: `var(--color-${stage.colorToken}-50)`,
                    color: `var(--color-${stage.colorToken}-700)`,
                  }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-[15px] font-medium text-text">{stage.label}</div>
                  <div className="truncate text-[13px] text-gray-500">{stage.description}</div>
                </div>
              </div>
            );
          })}
        </div>
        <blockquote className="mt-4 border-t border-border pt-5 font-serif text-[19px] italic leading-snug text-text-muted">
          &ldquo;The verification pass is why we stopped writing these by hand.&rdquo;
        </blockquote>
        <p className="text-[13px] text-gray-500">Content lead, 40-person SaaS</p>
      </div>
    </div>
  );
}
