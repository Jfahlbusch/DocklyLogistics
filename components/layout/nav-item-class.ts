import { cn } from "@/lib/utils";

/**
 * Menükachel (Portal: `.nav-sidebar .nav-link`): Icon-Spalte 20 px, 12,8 px Abstand zur Beschriftung, Innenabstand 7,8 × 13,6 px plus 1 px
 * Rand (durchsichtig, damit die Umrandung die Zeile nie verschiebt), Radius 10 px, Schrift 16 px / 500. Hover und Auswahl zeigen den
 * 1-px-Rand rundum und eine Fläche (8 % / 11 %); die Auswahl ist 700 fett und trägt das Icon in Gold. Es gibt keine Startkante (Nutzerregel
 * vom 02.10.2026). Auf niedrigen Displays (≤ 900 px) schrumpft der senkrechte Innenabstand auf 5 px, mobil und bei Touch-Bedienung
 * bleibt die Kachel mindestens 44 px hoch (L-Leitlinie Touch).
 */
export const NAV_TILE =
  "flex w-full items-center gap-[0.8rem] rounded-[10px] border border-transparent px-[12.6px] py-[7.8px] text-base font-medium leading-normal outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring short:py-[5px] max-nav:min-h-11 pointer-coarse:min-h-11";
const IDLE = "text-sidebar-foreground/70 hover:border-sidebar-border hover:bg-sidebar-foreground/[0.08] hover:text-sidebar-foreground";
const SELECTED = "border-sidebar-border bg-sidebar-foreground/[0.11] font-bold text-sidebar-foreground";

export const navTileClass = (selected: boolean, extra?: string) => cn(NAV_TILE, selected ? SELECTED : IDLE, extra);
/** Icon-Spalte der Kachel: 20 px breit, Zeichen 18,4 px (Portal: `font-size: 1.15rem`), in der Auswahl Gold. */
export const NAV_ICON_PX = 18;
export const navIconClass = (selected: boolean) => cn("flex w-5 shrink-0 justify-center", selected && "text-gold-400");
