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

  it("definiert --font-sans mit DM Sans", () => {
    expect(css).toMatch(/--font-sans:\s*var\(--font-dm-sans\)/);
  });
});
