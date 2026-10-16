import { describe, expect, it } from "vitest";
import {
  NAV_GROUPS,
  NAV_ITEMS,
  activeNavId,
  navGroups,
  tabItems,
} from "@/lib/navigation";

const LEGACY_IDS = [
  "dashboard", "articles", "suppliers", "stock", "warehouse", "suggestions",
  "orders", "edi", "reports", "audit", "settings", "admin",
];

describe("NAV_GROUPS", () => {
  it("hat die Reihenfolge Einkauf, Lager, Verwaltung", () => {
    expect(NAV_GROUPS).toEqual([
      { id: "einkauf", label: "Einkauf" },
      { id: "lager", label: "Lager" },
      { id: "verwaltung", label: "Verwaltung" },
    ]);
  });

  it("jede Gruppe hat mindestens einen Eintrag", () => {
    for (const g of NAV_GROUPS) {
      expect(NAV_ITEMS.filter((i) => i.group === g.id).length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("NAV_ITEMS", () => {
  it("enthält alle 12 bisherigen IDs", () => {
    expect(NAV_ITEMS.map((i) => i.id).sort()).toEqual([...LEGACY_IDS].sort());
  });

  it("markiert warehouse als accent", () => {
    expect(NAV_ITEMS.filter((i) => i.accent).map((i) => i.id)).toEqual(["warehouse"]);
  });
});

describe("navGroups", () => {
  it("liefert ohne Filter alle Gruppen in Reihenfolge", () => {
    const groups = navGroups();
    expect(groups.map((g) => g.id)).toEqual(["einkauf", "lager", "verwaltung"]);
    expect(groups.map((g) => g.label)).toEqual(["Einkauf", "Lager", "Verwaltung"]);
    expect(groups.flatMap((g) => g.items).length).toBe(12);
  });

  it("gruppiert Einträge in Registry-Reihenfolge", () => {
    const groups = navGroups();
    expect(groups[0].items.map((i) => i.id)).toEqual(["dashboard", "suggestions", "orders", "edi", "reports"]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["stock", "warehouse", "articles", "suppliers"]);
    expect(groups[2].items.map((i) => i.id)).toEqual(["audit", "settings", "admin"]);
  });

  it("lässt leere Gruppen weg", () => {
    const groups = navGroups(["dashboard"]);
    expect(groups.map((g) => g.id)).toEqual(["einkauf"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["dashboard"]);
  });

  it("liefert bei leerer Erlaubnisliste nichts", () => {
    expect(navGroups([])).toEqual([]);
  });

  it("ignoriert unbekannte IDs", () => {
    expect(navGroups(["gibtsnicht", "audit"]).map((g) => g.id)).toEqual(["verwaltung"]);
  });
});

describe("tabItems", () => {
  it("liefert ohne Filter genau die vier Tabs in Registry-Reihenfolge", () => {
    expect(tabItems().map((i) => i.id)).toEqual(["dashboard", "orders", "stock", "warehouse"]);
  });

  it("liefert höchstens 4 Einträge", () => {
    expect(tabItems().length).toBeLessThanOrEqual(4);
  });

  it("respektiert allowed", () => {
    expect(tabItems(["stock", "dashboard", "audit"]).map((i) => i.id)).toEqual(["dashboard", "stock"]);
  });
});

describe("activeNavId", () => {
  it("trifft Unterpfade", () => {
    expect(activeNavId("/orders/abc")).toBe("orders");
  });

  it("trifft exakte Pfade", () => {
    expect(activeNavId("/orders")).toBe("orders");
  });

  it("verwechselt /order-suggestions nicht mit orders", () => {
    expect(activeNavId("/order-suggestions")).toBe("suggestions");
  });

  it("liefert undefined für unbekannte Pfade", () => {
    expect(activeNavId("/unbekannt")).toBeUndefined();
  });

  it("trifft warehouse-mode", () => {
    expect(activeNavId("/warehouse-mode/scan")).toBe("warehouse");
  });
});
