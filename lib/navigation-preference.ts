import { z } from "zod";
import { NAV_AREAS, type NavArea } from "@/lib/navigation";

export type OpenNavigationAreas = Record<NavArea, boolean>;
// Cookie: ein Zeichen je Bereich in Registry-Reihenfolge (Übersicht, Einkauf, Lager, Verwaltung); Standard: alle offen — auch Verwaltung,
// damit „Einstellungen“ direkt im Menü steht (Nutzerwunsch 18.10.2026, abweichend von der Vorlage). Bewusst zugeklappte Bereiche bleiben zu.
export const NAVIGATION_COOKIE = "ui_nav_areas";
export const DEFAULT_OPEN_AREAS: OpenNavigationAreas = { overview: true, purchasing: true, warehouse: true, admin: true };
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
