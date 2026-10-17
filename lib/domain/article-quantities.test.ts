import { describe, it, expect } from "vitest";
import {
  effectiveTarget,
  suggestedOrderQty,
  exceedsCapacity,
  validateStockLevels,
} from "./article-quantities";

describe("effectiveTarget", () => {
  it("nimmt die empfohlene Menge, wenn gesetzt", () => {
    expect(effectiveTarget({ minStock: 100, targetStock: 300 })).toBe(300);
  });
  it("fällt ohne empfohlene Menge auf die Mindestmenge zurück", () => {
    expect(effectiveTarget({ minStock: 100, targetStock: null })).toBe(100);
  });
  it("behandelt 0 als gesetzten Wert", () => {
    expect(effectiveTarget({ minStock: 100, targetStock: 0 })).toBe(0);
  });
});

describe("suggestedOrderQty", () => {
  it("empfohlen 300, Bestand 120, packFactor 25 → 8", () => {
    expect(suggestedOrderQty({ minStock: 100, targetStock: 300, packFactor: 25 }, 120)).toBe(8);
  });
  it("rundet auf ganze Bestelleinheiten auf", () => {
    expect(suggestedOrderQty({ minStock: 0, targetStock: 301, packFactor: 25 }, 120)).toBe(8);
  });
  it("Bestand ≥ Ziel → 0", () => {
    expect(suggestedOrderQty({ minStock: 100, targetStock: 300, packFactor: 25 }, 300)).toBe(0);
    expect(suggestedOrderQty({ minStock: 100, targetStock: 300, packFactor: 25 }, 500)).toBe(0);
  });
  it("ohne empfohlene Menge wird gegen die Mindestmenge gerechnet", () => {
    expect(suggestedOrderQty({ minStock: 100, targetStock: null, packFactor: 25 }, 50)).toBe(2);
  });
  it("packFactor < 1 wird wie 1 behandelt", () => {
    expect(suggestedOrderQty({ minStock: 10, targetStock: null, packFactor: 0 }, 4)).toBe(6);
  });
});

describe("exceedsCapacity", () => {
  it("120 + 16 × 25 > 500 → true", () => {
    expect(exceedsCapacity({ maxStock: 500, packFactor: 25 }, 120, 16)).toBe(true);
  });
  it("genau an der Grenze → false", () => {
    expect(exceedsCapacity({ maxStock: 520, packFactor: 25 }, 120, 16)).toBe(false);
  });
  it("ohne maxStock immer false", () => {
    expect(exceedsCapacity({ maxStock: null, packFactor: 25 }, 120, 1000)).toBe(false);
  });
});

describe("validateStockLevels", () => {
  it("gültige und leere Kombinationen → keine Fehler", () => {
    expect(validateStockLevels({ minStock: 10, targetStock: 20, maxStock: 30 })).toEqual([]);
    expect(validateStockLevels({ minStock: 10, targetStock: null, maxStock: null })).toEqual([]);
    expect(validateStockLevels({ minStock: 10, targetStock: 10, maxStock: 10 })).toEqual([]);
  });
  it("targetStock < minStock → Fehler am Feld targetStock", () => {
    const e = validateStockLevels({ minStock: 100, targetStock: 50, maxStock: null });
    expect(e.map((x) => x.field)).toEqual(["targetStock"]);
  });
  it("targetStock > maxStock → Fehler am Feld targetStock", () => {
    const e = validateStockLevels({ minStock: 0, targetStock: 600, maxStock: 500 });
    expect(e.map((x) => x.field)).toEqual(["targetStock"]);
  });
  it("minStock > maxStock → Fehler am Feld maxStock", () => {
    const e = validateStockLevels({ minStock: 100, targetStock: null, maxStock: 50 });
    expect(e.map((x) => x.field)).toEqual(["maxStock"]);
    expect(e[0].message).toBeTruthy();
  });
});
