"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

export type ToastTone = "success" | "error" | "info" | "warning";

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** ms before auto-dismiss; 0 disables auto-dismiss. */
  duration?: number;
}

interface ToastRecord extends Required<Omit<ToastOptions, "description">> {
  id: string;
  description?: string;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<ToastTone, string> = {
  success: "border-success-200 bg-success-50 text-success-700",
  error: "border-error-200 bg-error-50 text-error-700",
  info: "border-info-200 bg-info-50 text-info-700",
  warning: "border-warning-200 bg-warning-50 text-warning-700",
};

/**
 * ToastProvider — wrap the app (or the gallery) once. Renders its viewport
 * through a portal, guarded by a `mounted` flag so the portal never renders
 * during SSR/first-paint (avoids the hydration mismatch noted in
 * tasks/README.md's known pitfalls for client-portal components).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = crypto.randomUUID();
      const duration = options.duration ?? 4000;
      const record: ToastRecord = {
        id,
        title: options.title,
        description: options.description,
        tone: options.tone ?? "info",
        duration,
      };
      setToasts((prev) => [...prev, record]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto"
            aria-live="polite"
            aria-atomic="false"
          >
            {toasts.map((t) => (
              <div
                key={t.id}
                role="status"
                className={cn(
                  "pointer-events-auto w-full max-w-sm animate-scale-in rounded-[var(--radius-lg)] border p-4 shadow-[var(--shadow-lg)]",
                  toneStyles[t.tone],
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{t.title}</p>
                    {t.description && <p className="mt-0.5 text-sm opacity-90">{t.description}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    aria-label="Dismiss notification"
                    className="shrink-0 rounded-[var(--radius-xs)] text-current opacity-60 hover:opacity-100"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
