import { describe, expect, it } from "vitest";
import {
  NAV_AREAS,
  NAV_ENTRIES,
  NAV_GROUPS,
  NAV_ITEMS,
  activeNavId,
  areaHref,
  findActiveEntry,
  navGroups,
  paletteNavEntries,
  segmentEntries,
  tabItems,
  visibleAreas,
  visibleEntries,
} from "@/lib/navigation";
import de from "../messages/de.json";

const LEGACY_IDS = [
  "dashboard", "articles", "suppliers", "stock", "warehouse", "suggestions",
  "orders", "edi", "reports", "audit", "settings", "admin",
];

// ── Registry-Modell der Vorlage (assets/layout/lib/navigation.ts): 4 Bereiche, `allowed` statt nur `minRole` ──

describe("NAV_AREAS", () => {
  it("hat die vier Bereiche in Anzeigereihenfolge", () => {
    expect(NAV_AREAS.map((a) => a.id)).toEqual(["overview", "purchasing", "warehouse", "admin"]);
    expect(NAV_AREAS.map((a) => a.labelKey)).toEqual([
      "nav.areas.overview", "nav.areas.purchasing", "nav.areas.warehouse", "nav.areas.admin",
    ]);
    expect(NAV_AREAS.every((a) => a.icon)).toBe(true);
  });

  it("übersetzt die Bereichsnamen über de.json", () => {
    expect(de.nav.areas).toEqual({ overview: "Übersicht", purchasing: "Einkauf", warehouse: "Lager", admin: "Verwaltung" });
  });
});

describe("NAV_ENTRIES", () => {
  it("enthält alle 12 bisherigen IDs genau einmal", () => {
    expect(NAV_ENTRIES.map((e) => e.id).sort()).toEqual([...LEGACY_IDS].sort());
  });

  it("ordnet die Einträge den Bereichen in Anzeigereihenfolge zu", () => {
    const byArea = (area: string) => NAV_ENTRIES.filter((e) => e.area === area).map((e) => [e.id, e.href]);
    expect(byArea("overview")).toEqual([["dashboard", "/dashboard"]]);
    expect(byArea("purchasing")).toEqual([
      ["suggestions", "/order-suggestions"], ["orders", "/orders"], ["edi", "/edi"], ["reports", "/reports"],
    ]);
    expect(byArea("warehouse")).toEqual([
      ["stock", "/stock"], ["warehouse", "/warehouse-mode"], ["articles", "/articles"], ["suppliers", "/suppliers"],
    ]);
    expect(byArea("admin")).toEqual([["audit", "/audit"], ["settings", "/settings"], ["admin", "/admin"]]);
  });

  it("jeder labelKey existiert in de.json (nav.*)", () => {
    const lookup = (key: string) => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], de);
    for (const e of NAV_ENTRIES) expect(typeof lookup(e.labelKey), e.id).toBe("string");
  });
});

describe("visibleEntries / visibleAreas / areaHref (allowed-Filter)", () => {
  it("liefert ohne Filter alle 12 Einträge in Registry-Reihenfolge", () => {
    expect(visibleEntries("VIEWER").map((e) => e.id)).toEqual(NAV_ENTRIES.map((e) => e.id));
  });

  it("filtert über allowed und behält die Registry-Reihenfolge", () => {
    expect(visibleEntries("USER", NAV_ENTRIES, ["audit", "stock", "dashboard"]).map((e) => e.id)).toEqual(["dashboard", "stock", "audit"]);
    expect(visibleEntries("USER", NAV_ENTRIES, [])).toEqual([]);
  });

  it("blendet Bereiche ohne erlaubten Eintrag aus", () => {
    expect(visibleAreas("USER").map((a) => a.id)).toEqual(["overview", "purchasing", "warehouse", "admin"]);
    expect(visibleAreas("USER", NAV_ENTRIES, ["dashboard", "stock"]).map((a) => a.id)).toEqual(["overview", "warehouse"]);
  });

  it("areaHref ist das Ziel des ersten erlaubten Eintrags", () => {
    expect(areaHref("purchasing", "USER")).toBe("/order-suggestions");
    expect(areaHref("purchasing", "USER", NAV_ENTRIES, ["orders", "edi"])).toBe("/orders");
    expect(areaHref("admin", "USER", NAV_ENTRIES, ["dashboard"])).toBeNull();
  });

  it("segmentEntries liefert die erlaubten Einträge eines Bereichs", () => {
    expect(segmentEntries("warehouse", "USER", NAV_ENTRIES, ["suppliers", "stock"]).map((e) => e.id)).toEqual(["stock", "suppliers"]);
  });

  it("respektiert minRole, wenn ein Eintrag eine Mindestrolle trägt", () => {
    const entries = [
      { ...NAV_ENTRIES[0], id: "a" },
      { ...NAV_ENTRIES[1], id: "b", minRole: "MANAGER" as const },
    ];
    expect(visibleEntries("USER", entries).map((e) => e.id)).toEqual(["a"]);
    expect(visibleEntries("MANAGER", entries).map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("findActiveEntry", () => {
  it("trifft Unterpfade und exakte Pfade", () => {
    expect(findActiveEntry("/orders")?.id).toBe("orders");
    expect(findActiveEntry("/orders/abc")?.id).toBe("orders");
  });

  it("verwechselt /order-suggestions nicht mit orders", () => {
    const active = findActiveEntry("/order-suggestions");
    expect(active?.id).toBe("suggestions");
    expect(active?.id).not.toBe("orders");
    expect(active?.area).toBe("purchasing");
  });

  it("liefert null für unbekannte Pfade", () => {
    expect(findActiveEntry("/unbekannt")).toBeNull();
  });
});

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
