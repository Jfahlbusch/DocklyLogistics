// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Nutzerregel (02.10.2026): Ausgewählte oder aktive Elemente im Menü erhalten keine farbige Kante am Zeilenanfang, auch nicht als
// Pseudo-Element oder inset-Schatten. Im Portal (develop 1aff3fd) trägt die aktive Kachel nur einen gleichmäßigen 1-px-Rahmen rundum (`border`
// auf allen vier Seiten, kein Streifen); der ältere Portal-Stand mit gelbem Streifen wurde bewusst nicht übernommen. jsdom berechnet keine
// Tailwind-Stile, deshalb prüft die Wache die Klassen aller Menübausteine; der berechnete Stil (gleiche Randbreite und -farbe aller Seiten,
// box-shadow) wird in tests/e2e/ux/menu.spec.ts im Browser geprüft.
const FILES = [
  "nav-link-list", "nav-area-trigger", "nav-links", "nav-item-class", "tenant-card", "tenant-switcher", "sidebar-user", "sidebar-footer",
  "sidebar-action", "sidebar-theme-action", "sidebar-toggle", "sidebar", "mobile-nav", "brand",
];
const EDGE = /\b(?:[\w-]+:)*(?:border-(?:l|s|ls)\b|border-(?:l|s)-|border-l-\[|border-s-\[|inset-s|shadow-\[inset|inset-shadow|ring-inset|before:w-|before:border-l)/;

describe("Menü ohne Seitenstreifen", () => {
  for (const name of FILES) {
    const file = ["nav-item-class", "sidebar-action"].includes(name) ? `${name}.ts` : `${name}.tsx`;
    const target = path.resolve(__dirname, `../../components/layout/${file}`);
    // Abweichung von der Vorlage (S1): Die Menübausteine der Vorlage kommen erst mit S2 ins Repo; bis dahin prüft die Wache nur, was existiert.
    it.skipIf(!existsSync(target))(`${name}.tsx: keine Start-Kante, kein inset-Schatten`, () => {
      const source = readFileSync(target, "utf8");
      const classes = [...source.matchAll(/"([^"\n]*)"/g)].map((match) => match[1] ?? "").filter((value) => value.includes(" ") || value.includes("-"));
      expect(classes.filter((value) => EDGE.test(value))).toEqual([]);
    });
  }
  it("sidebar-geometry.ts: der Rahmen der Leiste ist gleichmäßig", () => {
    const source = readFileSync(path.resolve(__dirname, "../../lib/sidebar-geometry.ts"), "utf8");
    const classes = [...source.matchAll(/"([^"\n]*)"/g)].map((match) => match[1] ?? "").filter((value) => value.includes(" "));
    expect(classes.filter((value) => EDGE.test(value))).toEqual([]);
  });
  it("die Wache erkennt Kanten und Schatten", () => {
    for (const value of ["border-l-2 border-gold-400", "md:border-s-4", "shadow-[inset_3px_0_0_gold]", "before:border-l-2", "ring-inset"]) expect(EDGE.test(value)).toBe(true);
    expect(EDGE.test("border-b border-sidebar-foreground/10 border-t")).toBe(false);
  });
});
