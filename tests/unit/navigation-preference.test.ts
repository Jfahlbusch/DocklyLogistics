import { describe, expect, it } from "vitest";
import { DEFAULT_OPEN_AREAS, navigationFlyouts, navigationListHeight, readNavigationPreference } from "@/lib/navigation-preference";
import { NAV_ENTRIES, visibleEntries } from "@/lib/navigation";

describe("Unabhängige Menüpräferenzen", () => {
  // Nutzerwunsch 18.10.2026: „Einstellungen“ (Verwaltung) steht direkt im Menü statt im Popup — Verwaltung ist standardmäßig offen.
  it("öffnet standardmäßig alle Bereiche, auch bei ungültigem Cookie", () => {
    for (const value of [undefined, "", "garbage", "11111", "__proto__"]) expect(readNavigationPreference(value)).toEqual(DEFAULT_OPEN_AREAS);
    expect(DEFAULT_OPEN_AREAS).toEqual({ overview: true, purchasing: true, warehouse: true, admin: true });
  });
  it("stellt nur die vier zulässigen Anzeigezustände wieder her (bewusst zugeklappte Bereiche bleiben zu)", () => {
    expect(readNavigationPreference("0101")).toEqual({ overview: false, purchasing: true, warehouse: false, admin: true });
    expect(readNavigationPreference("1110")).toEqual({ overview: true, purchasing: true, warehouse: true, admin: false });
  });
  // Wache zur UX-Regel „Menü bleibt viewporthoch / bei Platzmangel Popover, keine Scrollfläche“. Statt runder Zahlen prüft sie die
  // exakte Grenze: Jeder zusätzliche Eintrag verschiebt sie und muss hier bewusst nachgezogen werden.
  // Maße je Dichte: normal Kachel 41,6 / Kopf 35,4 px; compact 36 / 31,4 px; touch 44 / 44 px ohne Listenrand; 8 px Listenrand, 1,6 px Abstand.
  // Bereiche: Übersicht 1 Eintrag, Einkauf 4, Lager 4, Verwaltung 3. Bedarf: normal 685,6, compact 602,4, touch 716,8 px.
  // Auslagerungsreihenfolge (Nutzerwunsch 18.10.2026): erst die großen Fachbereiche Lager → Einkauf, dann Verwaltung, zuletzt Übersicht —
  // nie zuerst der Bereich der aktuellen Seite. Nach Lager bleiben 506,4 / 445,6 / 536 px.
  const NEED = { normal: 686, compact: 603, touch: 717 } as const;
  const WAREHOUSE_OUT = { normal: 507, compact: 446, touch: 536 } as const;
  // Nav-Kapazität der Referenzdisplays: Desktop 1280 × 720 → 521 px, mobil 375 × 812 → 609 px (siehe tests/e2e/ux/menu.spec.ts).
  const DESKTOP_720 = 521;
  const MOBILE_812 = 609;
  const all = () => visibleEntries("GLOBAL_ADMIN");
  it("lagert ab der exakten Bedarfshöhe zuerst Lager aus — Verwaltung (Einstellungen) bleibt im Menü", () => {
    for (const density of ["normal", "compact", "touch"] as const) {
      expect(navigationFlyouts(all(), DEFAULT_OPEN_AREAS, NEED[density], density).size, density).toBe(0);
      expect([...navigationFlyouts(all(), DEFAULT_OPEN_AREAS, NEED[density] - 1, density)], density).toEqual(["warehouse"]);
      expect([...navigationFlyouts(all(), DEFAULT_OPEN_AREAS, WAREHOUSE_OUT[density], density)], density).toEqual(["warehouse"]);
    }
    expect(navigationFlyouts(all(), DEFAULT_OPEN_AREAS, 1000, "normal").size).toBe(0);
  });
  it("lagert den Bereich der aktuellen Seite nicht zuerst aus (auf einer Lagerseite geht Einkauf ins Popover)", () => {
    for (const density of ["normal", "compact", "touch"] as const) {
      expect([...navigationFlyouts(all(), DEFAULT_OPEN_AREAS, NEED[density] - 1, density, "warehouse")], density).toEqual(["purchasing"]);
    }
  });
  it("Nicht-Happy-Path: einen Pixel unter der Grenze wandert auch Einkauf ins Popover, Übersicht und Verwaltung bleiben offen", () => {
    for (const density of ["normal", "compact", "touch"] as const) {
      expect([...navigationFlyouts(all(), DEFAULT_OPEN_AREAS, WAREHOUSE_OUT[density] - 1, density)], density).toEqual(["warehouse", "purchasing"]);
    }
  });
  it("Referenzdisplays 1280 × 720 und 375 × 812: nur ein Fachbereich als Popover, Verwaltung bleibt offen", () => {
    expect([...navigationFlyouts(all(), DEFAULT_OPEN_AREAS, DESKTOP_720, "compact")]).toEqual(["warehouse"]);
    expect([...navigationFlyouts(all(), DEFAULT_OPEN_AREAS, MOBILE_812, "touch")]).toEqual(["warehouse"]);
  });
  it("berücksichtigt die Zielgrößen je Dichte und blendet nicht erlaubte Ziele nicht ein", () => {
    const viewer = visibleEntries("VIEWER", undefined, ["dashboard", "orders", "stock"]);
    expect(navigationFlyouts(viewer, DEFAULT_OPEN_AREAS, MOBILE_812, "touch").size).toBe(0);
    expect(navigationFlyouts(viewer, DEFAULT_OPEN_AREAS, 520, "normal").size).toBe(0);
    expect([...navigationFlyouts(all(), DEFAULT_OPEN_AREAS, 186, "touch")]).toEqual(["warehouse", "purchasing", "admin", "overview"]);
    expect(navigationFlyouts(all(), DEFAULT_OPEN_AREAS, null, "touch").size).toBe(0);
  });
  it("bewusst zugeklappte Verwaltung wird trotzdem als Inline-Ziel eingeplant (Aufklappen klappt nichts anderes zu)", () => {
    const closedAdmin = { ...DEFAULT_OPEN_AREAS, admin: false };
    expect(navigationFlyouts(all(), closedAdmin, NEED.compact, "compact").size).toBe(0);
    expect([...navigationFlyouts(all(), closedAdmin, NEED.compact - 1, "compact")]).toEqual(["warehouse"]);
  });
  it("rechnet die Zielliste aus Rand, Kacheln und Zwischenraum", () => {
    expect(navigationListHeight(1, "normal")).toBeCloseTo(49.6, 5);
    expect(navigationListHeight(5, "compact")).toBeCloseTo(194.4, 5);
    expect(navigationListHeight(3, "touch")).toBeCloseTo(135.2, 5);
    expect(navigationListHeight(0, "touch")).toBe(0);
  });
});
