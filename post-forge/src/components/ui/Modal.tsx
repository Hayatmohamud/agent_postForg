"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** "modal" centers a dialog; "drawer" slides in from the right (mobile-friendly full-height panel). */
  variant?: "modal" | "drawer";
  className?: string;
}

/**
 * Shared modal/drawer primitive. Portal-rendered with a mounted-guard
 * (see Toast.tsx for why) and closes on Escape / backdrop click.
 */
export function Modal({ open, onClose, title, children, footer, variant = "modal", className }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const isDrawer = variant === "drawer";

  return createPortal(
    <div className="fixed inset-0 z-50 flex" role="presentation">
      <div
        className="absolute inset-0 animate-fade-in bg-gray-900/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative flex flex-col bg-white shadow-[var(--shadow-xl)]",
          isDrawer
            ? "ml-auto h-full w-full max-w-md animate-scale-in"
            : "m-auto max-h-[85vh] w-full max-w-lg animate-scale-in rounded-[var(--radius-xl)]",
          className,
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-[var(--radius-sm)] p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              &times;
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
