"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

/** Simple accessible tabs (roving tab index via native keyboard nav on radio-like buttons). */
export function Tabs({ items, defaultValue, value, onValueChange, className }: TabsProps) {
  const groupId = useId();
  const [internal, setInternal] = useState(defaultValue ?? items[0]?.value);
  const active = value ?? internal;

  function select(next: string) {
    setInternal(next);
    onValueChange?.(next);
  }

  const activeItem = items.find((i) => i.value === active);

  return (
    <div className={className}>
      <div role="tablist" className="flex items-center gap-1 border-b border-border">
        {items.map((item) => {
          const isActive = item.value === active;
          return (
            <button
              key={item.value}
              role="tab"
              id={`${groupId}-tab-${item.value}`}
              aria-selected={isActive}
              aria-controls={`${groupId}-panel-${item.value}`}
              disabled={item.disabled}
              onClick={() => select(item.value)}
              className={cn(
                "relative -mb-px px-3 py-2 text-sm font-medium transition-colors duration-[var(--duration-fast)]",
                "disabled:cursor-not-allowed disabled:opacity-40",
                isActive
                  ? "border-b-2 border-brand-600 text-brand-700"
                  : "border-b-2 border-transparent text-gray-500 hover:text-gray-800",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {activeItem && (
        <div
          role="tabpanel"
          id={`${groupId}-panel-${activeItem.value}`}
          aria-labelledby={`${groupId}-tab-${activeItem.value}`}
          className="animate-fade-in pt-4"
        >
          {activeItem.content}
        </div>
      )}
    </div>
  );
}
