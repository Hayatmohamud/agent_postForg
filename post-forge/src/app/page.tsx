import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, Badge, Card, CardDescription, CardTitle } from "@/components/ui";
import { AGENT_STAGES } from "@/components/pipeline";
import { PipelinePreview } from "@/components/landing/PipelinePreview";
import { LinkButton } from "@/components/landing/LinkButton";
import { LibraryIcon, ScheduleIcon, CheckIcon } from "@/components/landing/icons";

export const metadata: Metadata = {
  title: "PostForge — Autonomous multi-agent content generator",
  description:
    "Give PostForge a topic. Six autonomous AI agents research, fact-verify, write, edit, illustrate, and publish a sourced, illustrated post — end to end, with no human in the loop.",
  openGraph: {
    title: "PostForge — Autonomous multi-agent content generator",
    description:
      "Type a topic. Watch six AI agents research, verify, write, edit, illustrate, and publish a finished post.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PostForge — Autonomous multi-agent content generator",
    description:
      "Type a topic. Watch six AI agents research, verify, write, edit, illustrate, and publish a finished post.",
  },
};

const FEATURES: Array<{
  key: keyof typeof AGENT_STAGES | "library" | "schedule";
  title: string;
  description: string;
}> = [
  {
    key: "research",
    title: "Autonomous research",
    description:
      "The Research agent searches the web for your topic and pulls the most relevant, current sources — no manual digging required.",
  },
  {
    key: "verify",
    title: "Fact-verification with sources",
    description:
      "Every claim is cross-checked before it reaches the page. Unsupported claims are dropped or flagged, and each surviving one keeps its citation.",
  },
  {
    key: "illustrate",
    title: "Auto-generated poster",
    description:
      "The Illustrator agent crafts an image prompt from the finished post and generates a matching poster — no separate design step.",
  },
  {
    key: "library",
    title: "Your library",
    description:
      "Every run is saved — searchable, filterable, and ready to revisit. PostForge remembers past topics so it never starts from zero.",
  },
  {
    key: "schedule",
    title: "Scheduling",
    description:
      "Set a cadence and a theme, and PostForge keeps publishing on autopilot — enable, disable, or run a schedule on demand.",
  },
];

const TESTIMONIALS = [
  {
    name: "Priya Natarajan",
    role: "Solo creator",
    quote:
      "I type a topic before my coffee finishes brewing and there's a sourced, illustrated post waiting by the time I sit down.",
  },
  {
    name: "Marcus Webb",
    role: "Marketing lead",
    quote:
      "The verification step is what sold my team — every claim traces back to a real source we can check ourselves.",
  },
  {
    name: "Dana Okafor",
    role: "Indie developer",
    quote:
      "Watching the pipeline work live is genuinely the best part of the product. It feels like a small newsroom, not a script.",
  },
];

const PRICING_POINTS = [
  "Unlimited topics, six agents on every run",
  "Full source citations on every claim",
  "Auto-generated poster art included",
  "Scheduling for recurring topics",
];

function FeatureIcon({ featureKey }: { featureKey: (typeof FEATURES)[number]["key"] }) {
  if (featureKey === "library") {
    return <LibraryIcon className="h-[18px] w-[18px]" />;
  }
  if (featureKey === "schedule") {
    return <ScheduleIcon className="h-[18px] w-[18px]" />;
  }
  const meta = AGENT_STAGES[featureKey];
  const Icon = meta.icon;
  return <Icon />;
}

function featureAccentStyle(featureKey: (typeof FEATURES)[number]["key"]) {
  if (featureKey === "library" || featureKey === "schedule") {
    return { backgroundColor: "var(--color-brand-50)", color: "var(--color-brand-600)" };
  }
  const meta = AGENT_STAGES[featureKey];
  return {
    backgroundColor: `var(--color-${meta.colorToken}-50)`,
    color: `var(--color-${meta.colorToken}-600)`,
  };
}

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      {/* ---- Nav ---- */}
      <header className="sticky top-0 z-10 border-b border-border bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold text-gray-900">
            PostForge
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3" aria-label="Primary">
            <LinkButton href="/sign-in" variant="ghost" size="sm">
              Sign in
            </LinkButton>
            <LinkButton href="/sign-up" variant="primary" size="sm">
              Get started
            </LinkButton>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* ---- Hero ---- */}
        <section className="mx-auto max-w-6xl px-6 pt-14 pb-16 sm:pt-20 sm:pb-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="max-w-xl">
              <Badge tone="brand" className="mb-5">
                Six autonomous agents, one finished post
              </Badge>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-gray-900 sm:text-5xl">
                Type a topic. Get a sourced, illustrated post — written by a team of AI agents.
              </h1>
              <p className="mt-5 text-lg text-gray-600">
                PostForge researches the web, verifies every claim, drafts and edits the piece,
                generates a poster, and publishes it — fully autonomously, end to end.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <LinkButton href="/sign-up" size="lg">
                  Start free
                </LinkButton>
                <LinkButton href="/sign-in" variant="secondary" size="lg">
                  Sign in
                </LinkButton>
              </div>
              <p className="mt-4 text-sm text-gray-500">No credit card required.</p>
            </div>
            <PipelinePreview />
          </div>
        </section>

        {/* ---- Features ---- */}
        <section className="border-t border-border bg-gray-50/60 py-16 sm:py-20" id="features">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold text-gray-900">
                Every stage of the pipeline, handled
              </h2>
              <p className="mt-3 text-gray-600">
                From the first search query to the published post, each stage is a specialized
                agent with a clear, auditable job.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <Card key={feature.key}>
                  <div
                    className="mb-4 flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)]"
                    style={featureAccentStyle(feature.key)}
                  >
                    <FeatureIcon featureKey={feature.key} />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription className="mt-1.5">{feature.description}</CardDescription>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Social proof ---- */}
        <section className="py-16 sm:py-20" aria-labelledby="social-proof-heading">
          <div className="mx-auto max-w-6xl px-6">
            <h2 id="social-proof-heading" className="text-center text-3xl font-semibold text-gray-900">
              Trusted by creators who ship
            </h2>
            <div className="mt-12 grid gap-5 sm:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <Card key={t.name}>
                  <p className="text-sm text-gray-700">&ldquo;{t.quote}&rdquo;</p>
                  <div className="mt-5 flex items-center gap-3">
                    <Avatar name={t.name} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.role}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Pricing-style CTA ---- */}
        <section className="border-t border-border bg-gray-50/60 py-16 sm:py-20" id="get-started">
          <div className="mx-auto max-w-3xl px-6">
            <div className="rounded-[var(--radius-2xl)] border border-border bg-white p-8 text-center shadow-[var(--shadow-lg)] sm:p-12">
              <h2 className="text-3xl font-semibold text-gray-900">Start publishing with PostForge</h2>
              <p className="mt-3 text-gray-600">
                Free while in preview. Bring your own OpenRouter and Serper keys, or use the shared
                defaults.
              </p>
              <ul className="mx-auto mt-8 grid max-w-md gap-3 text-left">
                {PRICING_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm text-gray-700">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-600"
                      aria-hidden="true"
                    >
                      <CheckIcon />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
              <div className="mt-9">
                <LinkButton href="/sign-up" size="lg">
                  Create your first post
                </LinkButton>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-border bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-lg font-semibold text-gray-900">PostForge</p>
              <p className="mt-2 max-w-xs text-sm text-gray-500">
                Autonomous multi-agent content generation — researched, verified, illustrated,
                published.
              </p>
            </div>
            <nav aria-label="Footer" className="flex flex-wrap gap-x-10 gap-y-4">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Product</p>
                <Link href="/#features" className="text-sm text-gray-600 hover:text-gray-900">
                  Features
                </Link>
                <Link href="/#get-started" className="text-sm text-gray-600 hover:text-gray-900">
                  Pricing
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Account</p>
                <Link href="/sign-in" className="text-sm text-gray-600 hover:text-gray-900">
                  Sign in
                </Link>
                <Link href="/sign-up" className="text-sm text-gray-600 hover:text-gray-900">
                  Sign up
                </Link>
              </div>
            </nav>
          </div>
          <p className="mt-10 text-xs text-gray-400">
            &copy; {new Date().getFullYear()} PostForge. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
