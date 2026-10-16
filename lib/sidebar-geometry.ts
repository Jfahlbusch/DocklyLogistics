// Geometrie des Seitenmenüs, 1:1 aus dem BackOfficeDigital-Portal (Branch develop, 1aff3fd, `_app_shell.scss`).
// Bootstrap-Variablen in Pixel: `--sidebar-gap` 0.75rem = 12 px, `--bs-border-radius-lg` ($border-radius-lg in `_settings.scss`) = 26 px,
// `--bs-border-radius` = 10 px, `--bs-border-width` = 1 px. Breakpoint `lg` = 992 px (darunter gleitet die Leiste als Drawer herein).
import { SIDEBAR_COLLAPSED_PX, SIDEBAR_EXPANDED_PX } from "@/lib/sidebar-preference";

export const SIDEBAR_GAP_PX = 12;
export const SIDEBAR_RADIUS_PX = 26;
/** Platz, den die schwebende Leiste im Seitengefüge belegt: Breite plus Abstand links und rechts (Portal: `margin-inline-start`). */
export const sidebarSpacePx = (collapsed: boolean) => (collapsed ? SIDEBAR_COLLAPSED_PX : SIDEBAR_EXPANDED_PX) + 2 * SIDEBAR_GAP_PX;

/**
 * Rahmen der schwebenden Leiste (Portal: `.sidebar`): Rand 1 px rundum, Radius 26 px, Schatten `--bs-box-shadow` (Klasse `.sidebar-panel` in
 * globals.css: 0 .5rem 1rem, 15 % der Textfarbe). Der Rand ist gleichmäßig; die Nutzerregel „keine Auswahlkante“ betrifft die Einträge, nicht den Rahmen.
 */
export const SIDEBAR_SHELL_CLASS =
  "app-sidebar sidebar-panel flex flex-col rounded-[26px] border border-sidebar-border text-sidebar-foreground";
