// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { DEFAULT_OPEN_AREAS, NAVIGATION_COOKIE, readNavigationPreference, writeNavigationPreference } from "@/lib/navigation-preference";

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
  it("schreibt die Präferenz als vier Zeichen in Registry-Reihenfolge", () => {
    writeNavigationPreference({ overview: true, purchasing: false, warehouse: true, admin: true });
    expect(document.cookie).toContain(`${NAVIGATION_COOKIE}=1011`);
  });
});
