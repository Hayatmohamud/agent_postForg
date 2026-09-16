import type { SVGProps } from "react";

/** Small line icons for landing feature cards that aren't one of the six pipeline stages. */

export function LibraryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="3.5" y="4" width="6" height="16" rx="1.2" />
      <rect x="10.5" y="6.5" width="6" height="13.5" rx="1.2" />
      <path d="M18.5 8 21 18.7a1.2 1.2 0 0 1-.88 1.45l-1.6.42" />
    </svg>
  );
}

export function ScheduleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v3.2M16 3v3.2" />
      <path d="M12 13v3l2 1.2" />
    </svg>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4.5 10.5 8 14l7.5-7.5" />
    </svg>
  );
}
