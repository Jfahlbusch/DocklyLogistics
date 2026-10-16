import { describe, expect, it } from "vitest";
import {
  NAV_GROUPS,
  NAV_ITEMS,
  activeNavId,
  navGroups,
  paletteNavEntries,
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

describe("tabLabel", () => {
  it("alle Tab-Einträge haben ein nicht-leeres Kurzlabel", () => {
    for (const i of NAV_ITEMS.filter((n) => n.tab)) {
      expect(i.tabLabel, i.id).toBeTruthy();
    }
  });

  it("nutzt die vorgegebenen Kurzlabels", () => {
    expect(tabItems().map((i) => [i.id, i.tabLabel])).toEqual([
      ["dashboard", "Start"],
      ["orders", "Bestellungen"],
      ["stock", "Bestand"],
      ["warehouse", "Scan"],
    ]);
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

describe("paletteNavEntries", () => {
  it("liefert ohne Filter und ohne Suchbegriff alle Einträge in Registry-Reihenfolge", () => {
    expect(paletteNavEntries("").map((e) => e.id)).toEqual(NAV_ITEMS.map((i) => i.id));
  });

  it("blendet nicht erlaubte IDs aus", () => {
    const ids = paletteNavEntries("", ["dashboard", "orders"]).map((e) => e.id);
    expect(ids).toEqual(["dashboard", "orders"]);
    expect(ids).not.toContain("admin");
    expect(ids).not.toContain("audit");
  });

  it("liefert bei leerer Erlaubnisliste nichts", () => {
    expect(paletteNavEntries("", [])).toEqual([]);
  });

  it("filtert den Suchbegriff case-insensitiv und ignoriert Leerraum", () => {
    expect(paletteNavEntries("  LAGER ").map((e) => e.id)).toEqual(["stock", "warehouse"]);
  });

  it("kombiniert Suchbegriff und Erlaubnis", () => {
    expect(paletteNavEntries("lager", ["stock"]).map((e) => e.id)).toEqual(["stock"]);
  });

  it("setzt als group das Gruppen-Label der Registry", () => {
    const byId = Object.fromEntries(paletteNavEntries("").map((e) => [e.id, e.group]));
    expect(byId.dashboard).toBe("Einkauf");
    expect(byId.warehouse).toBe("Lager");
    expect(byId.admin).toBe("Verwaltung");
  });

  it("bringt href und Icon aus der Registry mit", () => {
    const orders = paletteNavEntries("", ["orders"])[0];
    expect(orders.href).toBe("/orders");
    expect(orders.label).toBe("Bestellungen");
    expect(orders.icon).toBeDefined();
  });

  it("ordnet nach Registry, nicht nach der Reihenfolge der Erlaubnisliste", () => {
    expect(paletteNavEntries("", ["audit", "stock", "dashboard"]).map((e) => e.id)).toEqual([
      "dashboard", "stock", "audit",
    ]);
  });
});
