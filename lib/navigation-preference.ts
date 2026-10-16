import { z } from "zod";
import { NAV_AREAS, type NavArea, type NavEntry } from "@/lib/navigation";

export type OpenNavigationAreas = Record<NavArea, boolean>;
// Cookie: ein Zeichen je Bereich in Registry-Reihenfolge (Übersicht, Einkauf, Lager, Verwaltung); Standard: alle offen außer Verwaltung.
export const NAVIGATION_COOKIE = "ui_nav_areas";
export const DEFAULT_OPEN_AREAS: OpenNavigationAreas = { overview: true, purchasing: true, warehouse: true, admin: false };
const preferenceSchema = z.string().regex(/^[01]{4}$/);

/** Reine Anzeigepräferenz; bereits im Server-HTML richtig, ohne Hydrationssprung. */
export function readNavigationPreference(value: string | undefined): OpenNavigationAreas {
  const parsed = preferenceSchema.safeParse(value);
  if (!parsed.success) return { ...DEFAULT_OPEN_AREAS };
  return { overview: parsed.data[0] === "1", purchasing: parsed.data[1] === "1", warehouse: parsed.data[2] === "1", admin: parsed.data[3] === "1" };
}

export function writeNavigationPreference(open: OpenNavigationAreas) {
  try {
    const value = NAV_AREAS.map(area => open[area.id] ? "1" : "0").join("");
    document.cookie = `${NAVIGATION_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  } catch { /* Gesperrte Cookies verhindern das Umschalten nicht. */ }
}

/**
 * Senkrechte Maße des Menüs in px, je Dichte. `normal`: Portal-Kachel 41,6 px (24 px Zeile + 2 × 7,8 px + 2 × 1 px Rand), Bereichskopf 35,4 px
 * (8 px oben, 8 px Außenabstand, 15,4 px Schrift, 4 px unten). `compact` (Display ≤ 900 px hoch): Kachel 36 px, Kopf 31,4 px (4 px oben).
 * `touch` (unter 992 px Breite oder Touch-Bedienung): Kachel und Kopf 44 px, kein Listenrand. Dazwischen 1,6 px Abstand (`gap: 0.1rem`).
 */
export type NavigationDensity = "normal" | "compact" | "touch";
export const NAVIGATION_METRICS: Record<NavigationDensity, { row: number; heading: number; listPadding: number }> = {
  normal: { row: 41.6, heading: 35.4, listPadding: 8 },
  compact: { row: 36, heading: 31.4, listPadding: 8 },
  touch: { row: 44, heading: 44, listPadding: 0 },
};
export const NAVIGATION_ROW_GAP = 1.6;

/** Höhe der geöffneten Zielliste eines Bereichs mit `count` Einträgen. */
export const navigationListHeight = (count: number, density: NavigationDensity) =>
  NAVIGATION_METRICS[density].listPadding + count * NAVIGATION_METRICS[density].row + Math.max(0, count - 1) * NAVIGATION_ROW_GAP;

/** Bei Platzmangel nur nötige Bereiche auslagern. Die Öffnungspräferenz bleibt unverändert. */
export function navigationFlyouts(entries: readonly NavEntry[], open: OpenNavigationAreas, height: number | null, density: NavigationDensity): Set<NavArea> {
  const areas = NAV_AREAS.filter(area => entries.some(entry => entry.area === area.id));
  const result = new Set<NavArea>();
  if (height === null) return result;
  const listOf = (area: NavArea) => navigationListHeight(entries.filter(entry => entry.area === area).length, density);
  // Verwaltung als letztes Inline-Ziel einplanen, auch wenn sie zunächst zu ist:
  // Ihr Öffnen darf die anderen Bereiche nicht nachträglich zuklappen.
  let required = (areas.length * NAVIGATION_METRICS[density].heading + areas.reduce((sum, area) => sum + (open[area.id] || area.id === "admin" ? listOf(area.id) : 0), 0));
  // Toleranz gegen Gleitkomma-Rauschen (828,0000000000001 px dürfen nicht als 829 px zählen).
  const fits = () => required - 1e-6 <= height;
  for (const area of [...areas].reverse()) {
    if (fits()) break;
    if (!open[area.id] && area.id !== "admin") continue;
    result.add(area.id);
    required -= listOf(area.id);
  }
  return result;
}
