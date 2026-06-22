"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type Theme } from "./theme-provider";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Hell", icon: Sun },
  { value: "dark", label: "Dunkel", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Segmented control (Hell / Dunkel / System) — übernommen aus DocklyInsurance. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Farbschema"
      className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1"
    >
      {OPTIONS.map((o) => {
        const Icon = o.icon;
        const active = theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            onClick={() => setTheme(o.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon size={14} strokeWidth={1.5} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
