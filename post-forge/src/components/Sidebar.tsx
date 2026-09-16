"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  CloseIcon,
  DashboardIcon,
  LibraryIcon,
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
          className="fixed inset-0 z-30 animate-fade-in bg-gray-900/40 md:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      )}
      <nav
        id={SIDEBAR_ID}
        aria-label="Primary"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col gap-1 border-r border-border bg-white p-4",
          "transition-transform duration-[var(--duration-base)] ease-[var(--ease-standard)]",
          "md:static md:z-auto md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-2 flex items-center justify-between md:hidden">
          <span className="text-sm font-semibold text-gray-900">Menu</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-[var(--radius-sm)] p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <CloseIcon />
          </button>
        </div>
        <ul className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname?.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors duration-[var(--duration-fast)]",
                    active
                      ? "bg-brand-50 text-brand-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                  )}
                >
                  <Icon />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
