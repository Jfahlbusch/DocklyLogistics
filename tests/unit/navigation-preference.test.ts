import { describe, expect, it } from "vitest";
import { DEFAULT_OPEN_AREAS, navigationFlyouts, navigationListHeight, readNavigationPreference } from "@/lib/navigation-preference";
import { NAV_ENTRIES, visibleEntries } from "@/lib/navigation";

describe("Unabhängige Menüpräferenzen", () => {
  it("öffnet nur Verwaltung nicht, auch bei ungültigem Cookie", () => {
    for (const value of [undefined, "", "garbage", "11111", "__proto__"]) expect(readNavigationPreference(value)).toEqual(DEFAULT_OPEN_AREAS);
    expect(DEFAULT_OPEN_AREAS).toEqual({ overview: true, purchasing: true, warehouse: true, admin: false });
  });
  it("stellt nur die vier zulässigen Anzeigezustände wieder her", () => {
    expect(readNavigationPreference("0101")).toEqual({ overview: false, purchasing: true, warehouse: false, admin: true });
  });
  // Wache zur UX-Regel „Menü bleibt viewporthoch / bei Platzmangel Popover, keine Scrollfläche“. Statt runder Zahlen prüft sie die
  // exakte Grenze: Jeder zusätzliche Eintrag in Übersicht, Einkauf oder Lager verschiebt sie und muss hier bewusst nachgezogen werden.
  // Maße des Portal-Menüs (develop 1aff3fd), je Dichte: normal kachel 41,6 px / Kopf 35,4 px; compact (Display ≤ 900 px hoch) 36 / 31,4 px;
  // touch (unter 992 px oder Touch) 44 / 44 px ohne Listenrand; dazu 8 px Listenrand (touch 0) und 1,6 px zwischen den Kacheln.
  // Unsere Bereiche: Übersicht 1 Eintrag, Einkauf 4, Lager 4, Verwaltung 3 (immer mit eingeplant).
  // Bedarf: normal 685,6 px, compact 602,4 px, touch 716,8 px. Nach dem Auslagern von Verwaltung bleiben 549,6 / 483,2 / 581,6 px offene Höhe.
  const NEED = { normal: 686, compact: 603, touch: 717 } as const;
  const ADMIN_OUT = { normal: 550, compact: 484, touch: 582 } as const;
  // Nav-Kapazität der Referenzdisplays (aus den festen Höhen der Bausteine gerechnet, in tests/e2e/ux/menu.spec.ts gegenzumessen):
  // Leiste = Display − 24 px Abstand − 2 px Rand; Marke 50, Unternehmens-Karte 70, Profilzeile 53 (touch 61 mit 44-px-Knöpfen, Karte 66
  // mit engerem Außenabstand), also Desktop 1280 × 720 → 521 px, mobil 375 × 812 → 609 px.
  const DESKTOP_720 = 521;
  const MOBILE_812 = 609;
  const all = () => visibleEntries("GLOBAL_ADMIN");
  it("lagert ab der exakten Bedarfshöhe nur Verwaltung aus, ohne andere Bereiche zu schließen", () => {
    for (const density of ["normal", "compact", "touch"] as const) {
      expect(navigationFlyouts(all(), DEFAULT_OPEN_AREAS, NEED[density], density).size, density).toBe(0);
      expect([...navigationFlyouts(all(), DEFAULT_OPEN_AREAS, NEED[density] - 1, density)], density).toEqual(["admin"]);
      expect([...navigationFlyouts(all(), { ...DEFAULT_OPEN_AREAS, admin: true }, NEED[density] - 1, density)], density).toEqual(["admin"]);
      expect([...navigationFlyouts(all(), DEFAULT_OPEN_AREAS, ADMIN_OUT[density], density)], density).toEqual(["admin"]);
    }
    expect(navigationFlyouts(all(), DEFAULT_OPEN_AREAS, 1000, "normal").size).toBe(0);
  });
  it("Nicht-Happy-Path: einen Pixel unter der Grenze wandert auch Lager ins Popover, Übersicht und Einkauf bleiben offen", () => {
    for (const density of ["normal", "compact", "touch"] as const) {
      expect([...navigationFlyouts(all(), DEFAULT_OPEN_AREAS, ADMIN_OUT[density] - 1, density)], density).toEqual(["admin", "warehouse"]);
    }
  });
  // Referenzdisplays: Es bleibt nur Verwaltung ausgelagert; Übersicht, Einkauf und Lager bleiben offen.
  it("Referenzdisplays 1280 × 720 und 375 × 812: nur Verwaltung als Popover, Lager bleibt offen", () => {
    expect([...navigationFlyouts(all(), DEFAULT_OPEN_AREAS, DESKTOP_720, "compact")]).toEqual(["admin"]);
    expect([...navigationFlyouts(all(), DEFAULT_OPEN_AREAS, MOBILE_812, "touch")]).toEqual(["admin"]);
  });
  // Unsere Sichtbarkeit läuft über Feature-Rechte (`allowed`), nicht über `minRole`: Nicht erlaubte Ziele zählen nicht mit.
  it("berücksichtigt die Zielgrößen je Dichte und blendet nicht erlaubte Ziele nicht ein", () => {
    const viewer = visibleEntries("VIEWER", undefined, ["dashboard", "orders", "stock"]);
    expect(navigationFlyouts(viewer, DEFAULT_OPEN_AREAS, MOBILE_812, "touch").size).toBe(0);
    expect(navigationFlyouts(viewer, DEFAULT_OPEN_AREAS, 520, "normal").size).toBe(0);
    expect([...navigationFlyouts(all(), DEFAULT_OPEN_AREAS, 186, "touch")]).toEqual(["admin", "warehouse", "purchasing", "overview"]);
    expect(navigationFlyouts(all(), DEFAULT_OPEN_AREAS, null, "touch").size).toBe(0);
  });
  it("kleinere Verwaltung (Eintrag nicht erlaubt) verschiebt die Grenze, Verwaltung wandert trotzdem zuerst ins Popover", () => {
    const withoutAdminPage = visibleEntries("GLOBAL_ADMIN", undefined, NAV_ENTRIES.map((entry) => entry.id).filter((id) => id !== "admin"));
    // Bedarf compact: 602,4 − (119,2 − 81,6) = 564,8 px
    expect(navigationFlyouts(withoutAdminPage, DEFAULT_OPEN_AREAS, 565, "compact").size).toBe(0);
    expect([...navigationFlyouts(withoutAdminPage, DEFAULT_OPEN_AREAS, 563, "compact")]).toEqual(["admin"]);
  });
  it("rechnet die Zielliste aus Rand, Kacheln und Zwischenraum", () => {
    expect(navigationListHeight(1, "normal")).toBeCloseTo(49.6, 5);
    expect(navigationListHeight(5, "compact")).toBeCloseTo(194.4, 5);
    expect(navigationListHeight(3, "touch")).toBeCloseTo(135.2, 5);
    expect(navigationListHeight(0, "touch")).toBe(0);
  });
});
