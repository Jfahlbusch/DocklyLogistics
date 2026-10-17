import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// T19 (M-B5): Regeltest gegen Rückfälle beim Mobil-/Tablet-Stand (docs/mobile-audit-2026-10-17.md).
// Statisch über die Quelltexte der App-Seiten — schnell, ohne Browser; die Pixelmessung macht T18 im Browser.

const ROOT = path.resolve(__dirname, "../..");
const APP = path.join(ROOT, "app/(app)");

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return /\.tsx$/.test(e.name) && !/\.test\.tsx$/.test(e.name) ? [p] : [];
  });
}
const pages = files(APP).map((f) => ({ file: path.relative(ROOT, f), src: fs.readFileSync(f, "utf8") }));

const COMPONENTS = path.join(ROOT, "components");
const sources = [...files(APP), ...files(COMPONENTS)].map((f) => ({ file: path.relative(ROOT, f), src: fs.readFileSync(f, "utf8") }));

describe("Mobil-Regeln für app/(app)", () => {
  it("nutzt keine nativen Browser-Dialoge confirm()/alert() — stattdessen useConfirm() bzw. toast (components/ui/confirm-dialog.tsx)", () => {
    // Erlaubt bleibt `confirm({ … })` des Hooks; verboten: window.confirm(, confirm("…"), confirm(`…`), confirm(msg), alert(…).
    const NATIVE = /\bwindow\.(confirm|alert)\(|(?<![\w$.])confirm\((?!\s*\{)|(?<![\w$.])alert\(/;
    const offenders = sources.filter(({ src }) => NATIVE.test(src)).map((p) => p.file);
    expect(offenders).toEqual([]);
  });

  it("nutzt für Dialoge nur ResponsiveDialog (Bottom-Sheet unter md), nie den zentrierten Dialog direkt", () => {
    const offenders = pages.filter(({ src }) => /from\s+["']@\/components\/ui\/dialog["']/.test(src)).map((p) => p.file);
    expect(offenders).toEqual([]);
  });

  it("baut keine eigenen Overlays (fixed inset-0) — ohne Radix fehlen Fokusfalle und Escape", () => {
    const offenders = pages.filter(({ src }) => /fixed\s+inset-0/.test(src)).map((p) => p.file);
    expect(offenders).toEqual([]);
  });

  it("gibt nativen select- und textarea-Feldern mobil mindestens 16 px Schrift (kein iOS-Zoom)", () => {
    const offenders: string[] = [];
    for (const { file, src } of pages) {
      // Konstanten der Datei, die einen native-field-Stil enthalten (z. B. `const FIELD = \`w-full ${NATIVE_TEXTAREA_CLASS}\``).
      const styled = [...src.matchAll(/const\s+(\w+)\s*=\s*[^;]*NATIVE_(?:SELECT|TEXTAREA)/g)].map((c) => c[1]);
      for (const m of src.matchAll(/<(select|textarea)\b/g)) {
        // Öffnendes Tag bis zum ersten Kind (<option) bzw. Tag-Ende — robust gegen `=>` und `>`-Vergleiche in Attributen.
        const start = m.index ?? 0;
        const ends = [src.indexOf("<option", start), src.indexOf("</select", start), src.indexOf("/>", start), src.indexOf("</textarea", start)].filter((i) => i > start);
        const tag = src.slice(start, Math.min(...ends, start + 800));
        const ok = /NATIVE_(SELECT|TEXTAREA)(_MONO)?_CLASS/.test(tag) || /\btext-base\b/.test(tag) || styled.some((n) => new RegExp(`\\{\\s*${n}\\s*\\}|\\$\\{${n}\\}`).test(tag));
        if (!ok) offenders.push(`${file}: ${tag.slice(0, 80).replace(/\s+/g, " ")}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("setzt an <Input> kein nacktes text-sm/text-xs (hebt das mobile text-base auf, F-M45)", () => {
    const offenders: string[] = [];
    for (const { file, src } of pages) {
      for (const m of src.matchAll(/<Input\b(?:=>|[^>])*>/g)) {
        if (/className=/.test(m[0]) && /(^|[\s"'`])text-(sm|xs)\b/.test(m[0])) offenders.push(`${file}: ${m[0].slice(0, 80).replace(/\s+/g, " ")}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("versteckt jede Daten-Tabelle mobil hinter einem Breakpoint (Karten-Variante daneben)", () => {
    const offenders: string[] = [];
    for (const { file, src } of pages) {
      if (!src.includes("<table")) continue;
      // Muster aus CLAUDE.md: Wrapper `hidden … md:block|lg:block|xl:block` bzw. per useMediaQuery umgeschaltet.
      const hasWrapper = /hidden[^"'`]*\b(md|lg|xl):block\b/.test(src);
      const switched = /useMediaQuery|useIsDesktop|MD_QUERY/.test(src);
      if (!hasWrapper && !switched) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
