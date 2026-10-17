import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Vertragstest Diagramm-Tokens (Design → „Charts & Grafiken“):
 * Dateien, die recharts importieren, nutzen ausschließlich Diagramm-Tokens
 * (--chart-*, --border, --muted-foreground) — nie Hex/rgb/hsl-Literale oder
 * Marken-Tokens (--primary, --accent, navy-*, gold-*).
 */
const ROOT = join(__dirname, "..", "..");

/** Ausnahmen: Datei (relativ zum Repo) → verbotenes Muster (Quelle) → Begründung. Aktuell leer. */
const EXCEPTIONS: { file: string; pattern: string; reason: string }[] = [];

export const FORBIDDEN: { name: string; re: RegExp }[] = [
  { name: "Hex-Farbe", re: /#[0-9a-fA-F]{3,8}\b/ },
  { name: "rgb()-Literal", re: /\brgba?\(/ },
  { name: "hsl()-Literal", re: /\bhsla?\(/ },
  { name: "--primary", re: /--primary\b/ },
  { name: "--accent", re: /--accent\b/ },
  { name: "navy-", re: /\bnavy-/ },
  { name: "gold-", re: /\bgold-/ },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(e) && !/\.test\./.test(e)) out.push(p);
  }
  return out;
}

export function violations(file: string, src: string): string[] {
  const rel = relative(ROOT, file);
  const res: string[] = [];
  src.split("\n").forEach((line, i) => {
    for (const f of FORBIDDEN) {
      if (!f.re.test(line)) continue;
      if (EXCEPTIONS.some((x) => x.file === rel && line.includes(x.pattern))) continue;
      res.push(`${rel}:${i + 1} ${f.name}: ${line.trim()}`);
    }
  });
  return res;
}

const chartFiles = ["app", "components"]
  .flatMap((d) => walk(join(ROOT, d)))
  .filter((f) => /from\s+["']recharts["']/.test(readFileSync(f, "utf8")));

describe("Diagramm-Tokens (Vertragstest)", () => {
  it("findet die Diagramm-Komponenten", () => {
    expect(chartFiles.length).toBeGreaterThan(0);
  });

  it("jede Ausnahme hat eine Begründung", () => {
    for (const x of EXCEPTIONS) expect(x.reason.length).toBeGreaterThan(10);
  });

  it("Erkennung greift auf Probe-Strings", () => {
    const bad = [`fill="#0F2A44"`, `stroke="rgb(1,2,3)"`, `fill="hsl(1 2% 3%)"`, `var(--primary)`, `var(--accent)`, `bg-navy-900`, `text-gold-500`];
    for (const b of bad) expect(violations("x.tsx", b).length, b).toBeGreaterThan(0);
    expect(violations("x.tsx", `fill="var(--chart-1)" stroke="var(--border)" id="#"`)).toEqual([]);
  });

  it.each(chartFiles.map((f) => [relative(ROOT, f), f]))("%s nutzt nur Diagramm-Tokens", (_rel, file) => {
    expect(violations(file, readFileSync(file, "utf8"))).toEqual([]);
  });
});
