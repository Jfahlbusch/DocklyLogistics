"use client";

import { ChevronsLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Runder Knopf auf der Kante der Leiste, zur Hälfte außerhalb (Portal: `.sidebar-toggle`): 32 px, 24 px von oben, 16 px nach außen,
 * Rand 1 px, Fläche der Leiste; Hover mischt 11 % Schrift in die Fläche. Das Symbol dreht sich eingeklappt um 180°.
 * Nur ab 992 px; bei Touch-Bedienung 44 px.
 */
export function SidebarToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const t = useTranslations("shell.sidebar");
  const label = collapsed ? t("expandMenu") : t("collapseMenu");
  return (
    <button type="button" onClick={onToggle} title={label} aria-label={label} aria-controls="app-sidebar"
      className="absolute -end-4 top-6 z-10 flex size-8 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground/70 outline-none transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--sidebar-foreground)_11%,var(--sidebar))] hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-11">
      <ChevronsLeft size={16} strokeWidth={1.5} aria-hidden className={cn("transition-transform duration-200 motion-reduce:transition-none", collapsed && "rotate-180")} />
    </button>
  );
}
