"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  CloseIcon,
  DashboardIcon,
  LibraryIcon,
  LogoMark,
  NewPostIcon,
  ScheduledIcon,
  SettingsIcon,
} from "@/components/shell/icons";

export const SIDEBAR_ID = "app-sidebar";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/new-post", label: "New Post", icon: NewPostIcon },
  { href: "/library", label: "Library", icon: LibraryIcon },
  { href: "/scheduled", label: "Scheduled", icon: ScheduledIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export interface SidebarProps {
  /** Whether the mobile off-canvas drawer is open. Ignored at md+ (always visible there). */
  open: boolean;
  onClose: () => void;
}

/**
 * Persistent left nav (Dashboard/New Post/Library/Scheduled/Settings), with
 * active-route highlighting via `usePathname`. Static column at md+; an
 * accessible off-canvas drawer (backdrop, Escape-to-close) below md.
 */
export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 animate-fade-in bg-black/40 md:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      )}
      <nav
        id={SIDEBAR_ID}
        aria-label="Primary"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[236px] shrink-0 flex-col border-r border-border bg-bg-sub",
          "transition-transform duration-[var(--duration-base)] ease-[var(--ease-standard)]",
          "md:static md:z-auto md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2.5 px-[18px] pb-3.5 pt-[18px]">
          <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-brand-600 text-white">
            <LogoMark />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-text">PostForge</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="ml-auto rounded-[var(--radius-sm)] p-1.5 text-gray-400 hover:bg-surface-2 hover:text-gray-600 md:hidden"
          >
            <CloseIcon />
          </button>
        </div>
        <ul className="flex flex-1 flex-col gap-0.5 px-2.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname?.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-sm transition-colors duration-[var(--duration-fast)]",
                    active
                      ? "bg-brand-50 font-semibold text-brand-700"
                      : "font-medium text-gray-600 hover:bg-surface-2 hover:text-text",
                  )}
                >
                  <Icon />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
        {/* Cosmetic usage summary — no real plan/quota system exists yet, consistent with this
            app's other cosmetic-stub UI (auth, "Continue with Google"); update if one ships. */}
        <div className="mt-auto p-3.5">
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-3">
            <div className="text-[13px] font-semibold text-text">Free plan</div>
            <div className="mt-0.5 text-xs text-gray-500">8 of 20 runs used</div>
            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-border">
              <div className="h-full w-2/5 rounded-full bg-brand-600" />
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
