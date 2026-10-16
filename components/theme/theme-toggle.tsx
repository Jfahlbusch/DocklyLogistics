"use client";

import { Sun, Moon, Monitor, Contrast } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme, type Theme } from "./theme-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Theme; icon: typeof Sun }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];

/**
 * Hell / Dunkel / System als radiogroup. `stacked`: untereinander als Menüzeilen (Popover im Menüfuß und in der Kopfleiste,
 * `seitenmenue.md` §3), sonst als Segment-Leiste (übernommen aus DocklyInsurance).
 */
export function ThemeOptions({ stacked = false }: { stacked?: boolean }) {
  const t = useTranslations("shell.theme");
  const { theme, setTheme } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label={t("label")}
      className={cn(
        stacked ? "flex flex-col gap-0.5" : "flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1",
      )}
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
            onClick={() => setTheme(o.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-md font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              stacked ? "min-h-11 w-full gap-3 px-3 text-sm" : "flex-1 justify-center px-2 py-1.5 text-xs",
              active
                ? stacked
                  ? "bg-muted text-foreground"
                  : "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              stacked && !active && "hover:bg-muted",
            )}
          >
            <Icon size={stacked ? 18 : 14} strokeWidth={1.5} aria-hidden />
            {t(o.value)}
          </button>
        );
      })}
    </div>
  );
}

/** Farbschema-Knopf der Kopfleiste unter 992 px — dort entfällt der Knopf im Menüfuß (`seitenmenue.md` §3). */
export function ThemeMenuButton({ className }: { className?: string }) {
  const t = useTranslations("shell.theme");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("label")}
          title={t("label")}
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <Contrast size={20} strokeWidth={1.5} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        <ThemeOptions stacked />
      </PopoverContent>
    </Popover>
  );
}
