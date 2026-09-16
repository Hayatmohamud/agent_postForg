import { createElement } from "react";
import type { ComponentType, SVGProps } from "react";

/**
 * Canonical Research -> Verify -> Write -> Edit -> Illustrate -> Publish
 * pipeline mapping. This is the single source of truth for stage order,
 * labels, icons, and accent colors — every later task (T08 dashboard, T11
 * live pipeline screen, T12 post detail) should import `AGENT_STAGES` /
 * `AGENT_ORDER` from here rather than redefining stage metadata.
 *
 * Accent tokens reference the `--color-agent-<key>-*` scales defined in
 * src/app/globals.css. Kept as a plain .ts module (no JSX) so it can be
 * imported from server code (e.g. Inngest step logic) without a bundler
 * needing to treat it as a client component.
 */
export type AgentKey =
  | "research"
  | "verify"
  | "write"
  | "edit"
  | "illustrate"
  | "publish";

export const AGENT_ORDER: AgentKey[] = [
  "research",
  "verify",
  "write",
  "edit",
  "illustrate",
  "publish",
];

type IconProps = SVGProps<SVGSVGElement>;

function icon(paths: Array<Record<string, unknown>>): ComponentType<IconProps> {
  const Icon = (props: IconProps) =>
    createElement(
      "svg",
      {
        width: 18,
        height: 18,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.75,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": true,
        ...props,
      },
      paths.map((p, i) => createElement(p.tag as string, { ...p, key: i, tag: undefined })),
    );
  return Icon;
}

export const ResearchIcon = icon([
  { tag: "circle", cx: 11, cy: 11, r: 6.5 },
  { tag: "path", d: "m20 20-3.8-3.8" },
]);

export const VerifyIcon = icon([
  { tag: "path", d: "M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6l-7-3Z" },
  { tag: "path", d: "m9.25 12 2 2 3.5-3.75" },
]);

export const WriteIcon = icon([
  { tag: "path", d: "M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" },
  { tag: "path", d: "m14 6 3 3" },
]);

export const EditIcon = icon([
  {
    tag: "path",
    d: "M12 3v2.2M12 18.8V21M4.2 12H3m18 0h-1.2M6 6l1.5 1.5M18 6l-1.5 1.5M6 18l1.5-1.5M18 18l-1.5-1.5",
  },
  { tag: "circle", cx: 12, cy: 12, r: 3.3 },
]);

export const IllustrateIcon = icon([
  { tag: "rect", x: 3.5, y: 4.5, width: 17, height: 15, rx: 2 },
  { tag: "circle", cx: 9, cy: 10, r: 1.6 },
  { tag: "path", d: "m5 17 4.5-4.5c.7-.7 1.8-.7 2.5 0L15 15.5" },
  { tag: "path", d: "m14 15-1-1c.7-.7 1.8-.7 2.5 0L19 18" },
]);

export const PublishIcon = icon([{ tag: "path", d: "m4 12 16-8-6 16-3-6-7-2Z" }]);

export interface AgentStageMeta {
  key: AgentKey;
  /** Short label used in the pipeline stepper / status badges. */
  label: string;
  /** One-line description of what the stage does, for tooltips/detail panels. */
  description: string;
  icon: ComponentType<IconProps>;
  /** Tailwind color-token stem, e.g. "agent-research" -> bg-agent-research-500. */
  colorToken: string;
}

export const AGENT_STAGES: Record<AgentKey, AgentStageMeta> = {
  research: {
    key: "research",
    label: "Research",
    description: "Searches the web and pulls top sources for the topic.",
    icon: ResearchIcon,
    colorToken: "agent-research",
  },
  verify: {
    key: "verify",
    label: "Verify",
    description: "Cross-checks each claim and drops unsupported ones.",
    icon: VerifyIcon,
    colorToken: "agent-verify",
  },
  write: {
    key: "write",
    label: "Write",
    description: "Drafts the post from verified findings.",
    icon: WriteIcon,
    colorToken: "agent-write",
  },
  edit: {
    key: "edit",
    label: "Edit",
    description: "Polishes tone, structure, and accuracy.",
    icon: EditIcon,
    colorToken: "agent-edit",
  },
  illustrate: {
    key: "illustrate",
    label: "Illustrate",
    description: "Generates a poster image for the post.",
    icon: IllustrateIcon,
    colorToken: "agent-illustrate",
  },
  publish: {
    key: "publish",
    label: "Publish",
    description: "Saves the finished post.",
    icon: PublishIcon,
    colorToken: "agent-publish",
  },
};
