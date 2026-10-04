"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Avatar, Button } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { SIDEBAR_ID } from "@/components/Sidebar";
import { BellIcon, ChevronDownIcon, MenuIcon, NewPostIcon } from "@/components/shell/icons";
import { ThemeToggle } from "@/components/shell/ThemeToggle";

function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme, toggleTheme } = useTheme();
  const { data: session } = useSession();
  const name = session?.user?.name ?? "Account";
  const email = session?.user?.email ?? "";

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-[var(--radius-lg)] border border-transparent py-1 pl-1 pr-2 hover:border-border hover:bg-surface-2"
      >
        <Avatar name={name} size="sm" />
        <span className="hidden text-sm text-text sm:inline">{name.split(" ")[0]}</span>
        <span className="hidden text-gray-400 sm:inline">
          <ChevronDownIcon />
        </span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-10 mt-2 w-52 animate-scale-in rounded-[var(--radius-lg)] border border-border bg-surface p-1.5 shadow-[var(--shadow-lg)]"
        >
          <div className="mb-1.5 border-b border-border px-2.5 pb-2 pt-1">
            <div className="text-sm font-semibold text-text">{name}</div>
            <div className="text-xs text-gray-500">{email}</div>
          </div>
          <Link
            role="menuitem"
            href="/settings"
            onClick={() => setOpen(false)}
            className="block rounded-[var(--radius-sm)] px-2.5 py-2 text-sm text-text hover:bg-surface-2"
          >
            Profile
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-sm text-text hover:bg-surface-2"
          >
            Theme
            <span className="capitalize text-gray-500">{resolvedTheme}</span>
          </button>
          <div className="my-1.5 h-px bg-border" />
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              signOut({ callbackUrl: "/" });
            }}
            className="block w-full rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-sm text-error-600 hover:bg-error-50"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export interface TopbarProps {
  mobileNavOpen: boolean;
  onToggleMobileNav: () => void;
}

/**
 * Persistent top bar: mobile nav toggle + logo (sidebar carries the logo at
 * md+), the global "New Post" CTA, a cosmetic notification bell, the real
 * theme toggle, and the profile menu. Search lives only on the Library page
 * (its own "Search by topic or title" field) — no global search bar here.
 */
export function Topbar({ mobileNavOpen, onToggleMobileNav }: TopbarProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-bg/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-bg/85 sm:px-6">
      <button
        type="button"
        onClick={onToggleMobileNav}
        aria-label="Toggle navigation"
        aria-expanded={mobileNavOpen}
        aria-controls={SIDEBAR_ID}
        className="-ml-1 flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-gray-500 hover:bg-surface-2 hover:text-text md:hidden"
      >
        <MenuIcon />
      </button>

      <Link href="/dashboard" className="flex shrink-0 items-center gap-2 md:hidden">
        <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-brand-600 text-sm font-bold text-white">
          PF
        </span>
        <span className="hidden text-sm font-semibold text-text sm:inline">PostForge</span>
      </Link>

      <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
        <Button size="sm" leftIcon={<NewPostIcon />} onClick={() => router.push("/new-post")}>
          New Post
        </Button>
        {/* Cosmetic — no notification backend exists yet. */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface text-gray-600 hover:bg-surface-2"
        >
          <BellIcon />
          <span className="absolute right-[7px] top-[7px] h-1.5 w-1.5 rounded-full border border-surface bg-brand-600" />
        </button>
        <ThemeToggle />
        <div className="mx-0.5 h-6 w-px bg-border" />
        <ProfileMenu />
      </div>
    </header>
  );
}
