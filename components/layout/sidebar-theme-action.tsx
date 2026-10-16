"use client";

import { Contrast } from "lucide-react";
import { useTranslations } from "next-intl";
import { SIDEBAR_ACTION_CLASS, SIDEBAR_ACTION_ICON_PX } from "./sidebar-action";
import { ThemeOptions } from "@/components/theme/theme-toggle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Farbschema-Knopf im Menüfuß (Portal: `theme-toggle` mit `ph-circle-half`). Er öffnet die drei Optionen (Hell, Dunkel, System) als Popover.
 * Unter 992 px liegt der Umschalter in der Kopfleiste, damit die Profilzeile im Drawer nicht eng wird; dort entfällt der Knopf.
 */
export function SidebarThemeAction({ collapsed }: { collapsed?: boolean }) {
  const t = useTranslations("shell.theme");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={t("label")} title={t("label")} className={cn(SIDEBAR_ACTION_CLASS, "max-nav:hidden")}>
          <Contrast size={SIDEBAR_ACTION_ICON_PX} strokeWidth={1.5} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent side={collapsed ? "right" : "top"} align="end" className="w-44 p-1">
        <ThemeOptions stacked />
      </PopoverContent>
    </Popover>
  );
}
