import { describe, expect, it } from "vitest";
import { nextMinimized } from "@/lib/scroll-direction";

describe("nextMinimized(prevTop, top, minimized)", () => {
  const rows: [string, number, number, boolean, boolean][] = [
    // [Fall, prevTop, top, minimized, erwartet]
    ["runter über Schwelle und unter der Kopfzone → minimiert", 100, 120, false, true],
    ["runter bleibt minimiert", 120, 200, true, true],
    ["Zittern unter der Schwelle (normal) → unverändert", 100, 105, false, false],
    ["Zittern unter der Schwelle (minimiert) → unverändert", 100, 95, true, true],
    ["genau Schwelle (8) zählt nicht", 100, 108, false, false],
    ["runter, aber noch in der Kopfzone (top ≤ 48) → normal", 10, 40, false, false],
    ["runter exakt auf top = 48 → noch normal", 30, 48, false, false],
    ["hoch über Schwelle → normal", 300, 280, true, false],
    ["hoch bleibt normal", 280, 200, false, false],
    ["nahe Top (< 48) → normal, auch ohne Richtungswechsel", 60, 47, true, false],
    ["Top 0 → normal", 5, 0, true, false],
    ["Gummiband-Überscroll (negativ) → normal", 0, -20, true, false],
    ["keine Bewegung → unverändert", 200, 200, true, true],
  ];

  it.each(rows)("%s", (_name, prev, top, minimized, expected) => {
    expect(nextMinimized(prev, top, minimized)).toBe(expected);
  });

  it("respektiert eine eigene Schwelle", () => {
    expect(nextMinimized(100, 120, false, 30)).toBe(false);
    expect(nextMinimized(100, 140, false, 30)).toBe(true);
  });
});
