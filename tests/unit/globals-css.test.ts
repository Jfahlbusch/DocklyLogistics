import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Eine CSS-Variable, die sich selbst referenziert (`--x: var(--x)`), ist ein
 * Zyklus und wird vom Browser als ungültig verworfen. Genau so war
 * `--font-sans` seit der shadcn-Initialisierung leer — die ganze App lief
 * in der Browser-Standardschrift (Times) statt in DM Sans.
 */
describe("app/globals.css", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");

  it("enthält keine selbstreferenzierenden Custom Properties", () => {
    const zyklen: string[] = [];
    for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      const [, name, value] = m;
      if (new RegExp(`var\\(\\s*${name}\\s*[,)]`).test(value)) zyklen.push(`${name}: ${value.trim()}`);
    }
    expect(zyklen).toEqual([]);
  });

  // Druckseiten (Zonen-Etikett) sind immer hell — auch wenn <html> die Klasse `.dark` trägt. `.print-surface` setzt die
  // Farb-Tokens auf die hellen Werte aus :root, damit Überschriften (color: var(--color-foreground)) lesbar bleiben.
  it(".print-surface übernimmt die hellen Farb-Tokens aus :root", () => {
    const block = (selector: string) => css.match(new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
    const tokens = (body: string) => Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
    const root = tokens(block(":root"));
    const print = tokens(block(".print-surface"));
    for (const name of ["--background", "--foreground", "--card", "--card-foreground", "--muted", "--muted-foreground", "--border"]) {
      expect(print[name], name).toBe(root[name]);
    }
    expect(block(".print-surface")).toMatch(/color-scheme:\s*light/);
  });

  it("definiert --font-sans mit DM Sans", () => {
    expect(css).toMatch(/--font-sans:\s*var\(--font-dm-sans\)/);
  });
});
