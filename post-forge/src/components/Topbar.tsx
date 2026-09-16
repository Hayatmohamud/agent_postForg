"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, Button, Input } from "@/components/ui";
import { SIDEBAR_ID } from "@/components/Sidebar";
import { MenuIcon, NewPostIcon, SearchIcon } from "@/components/shell/icons";

function AvatarMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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
        className="rounded-[var(--radius-full)]"
      >
        <Avatar name="Jordan Lee" size="sm" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-10 mt-2 w-48 animate-scale-in rounded-[var(--radius-md)] border border-border bg-white p-1 shadow-[var(--shadow-lg)]"
        >
          <div className="px-3 py-2 text-xs text-gray-400">Signed in (stub) &middot; hayadmohamudhassan</div>
          <Link
            role="menuitem"
            href="/settings"
            onClick={() => setOpen(false)}
            className="block rounded-[var(--radius-sm)] px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Settings
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => setOpen(false)}
            className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            Sign out
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
 * Persistent top bar: logo, mobile nav toggle, search (navigates to
 * `/library?q=...` — T06's real search endpoint doesn't exist yet, per the
 * BRD's fallback), the global "New Post" CTA, and a cosmetic avatar menu.
 */
export function Topbar({ mobileNavOpen, onToggleMobileNav }: TopbarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/library?q=${encodeURIComponent(trimmed)}` : "/library");
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-white/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:px-6">
      <button
        type="button"
        onClick={onToggleMobileNav}
        aria-label="Toggle navigation"
        aria-expanded={mobileNavOpen}
        aria-controls={SIDEBAR_ID}
        className="-ml-1 flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-gray-500 hover:bg-gray-100 hover:text-gray-900 md:hidden"
      >
        <MenuIcon />
      </button>

      <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-brand-600 text-sm font-bold text-white">
          PF
        </span>
        <span className="hidden text-sm font-semibold text-gray-900 sm:inline">PostForge</span>
      </Link>

      <form onSubmit={handleSearchSubmit} className="hidden flex-1 sm:block sm:max-w-sm">
        <Input
          aria-label="Search posts"
          placeholder="Search posts..."
          leftIcon={<SearchIcon />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <Button size="sm" leftIcon={<NewPostIcon />} onClick={() => router.push("/new-post")}>
          New Post
        </Button>
        <AvatarMenu />
      </div>
    </header>
  );
}
