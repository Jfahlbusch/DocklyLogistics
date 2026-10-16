"use client";

import type { ComponentProps } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ICON_PX, navIconClass, navTileClass } from "./nav-item-class";

type Props = Omit<ComponentProps<"button">, "children"> & {
  label: string;
  icon: LucideIcon;
  /** Eingeklappte Rail: nur das Bereichs-Icon als Kachel, die Ziele erscheinen im Popover. */
  collapsed?: boolean;
  /** Bereich ist offen (Pfeil dreht sich); im Popover-Modus bleibt der Pfeil stehen. */
  open?: boolean;
  /** Der aktive Eintrag liegt in diesem Bereich. */
  current?: boolean;
};

/**
 * Bereichsüberschrift (Portal: `.sidebar-heading`): 12,8 px / 600, 0,04 em gesperrt, gedämpft, Außenabstand 8 / 13,6 / 4 / 24,8 px
 * (oben / Ende / unten / Anfang), Normalschreibung. Anders als im Portal ein Schalter (Nutzerregel „Menübereiche bleiben offen“), darum
 * mit kleinem Pfeil am Ende. Mobil und bei Touch mindestens 44 px hoch (der Abstand entfällt dort). Eingeklappt ist der Bereich eine Kachel
 * mit seinem Icon (Portal-Rail), die Ziele öffnen sich im Popover.
 */
export function NavAreaTrigger({ label, icon: Icon, collapsed, open, current, className, ...props }: Props) {
  if (collapsed) {
    return (
      <button type="button" aria-label={label} title={label} {...props} className={cn(navTileClass(!!current), "justify-center px-0", className)}>
        <span className={navIconClass(!!current)}><Icon size={NAV_ICON_PX} strokeWidth={1.5} aria-hidden /></span>
      </button>
    );
  }
  return (
    <button type="button" aria-label={label} {...props}
      className={cn("mb-1 ms-[1.55rem] mt-2 flex w-[calc(100%_-_2.4rem)] items-center justify-between gap-2 rounded-md text-left text-[0.8rem] font-semibold leading-[1.2] tracking-[0.04em] outline-none transition-colors duration-200 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring max-nav:mb-0 max-nav:mt-0 max-nav:min-h-11 pointer-coarse:min-h-11",
        current ? "text-sidebar-foreground" : "text-sidebar-foreground/70", className)}>
      <span className="truncate">{label}</span>
      <ChevronDown size={12} aria-hidden className={cn("shrink-0 transition-transform duration-200", open && "rotate-180")} />
    </button>
  );
}
