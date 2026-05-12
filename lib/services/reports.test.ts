import { describe, it, expect } from "vitest";
import { toCsv } from "./reports";

describe("toCsv", () => {
  it("emits UTF-8 BOM + headers + rows", () => {
    const out = toCsv([
      { a: "1", b: "x" },
      { a: "2", b: "y" },
    ]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toContain("a;b");
    expect(out).toContain("1;x");
    expect(out).toContain("2;y");
  });
  it("escapes semicolons and quotes", () => {
    const out = toCsv([{ a: "has;semi", b: 'has "quote"' }]);
    expect(out).toContain('"has;semi"');
    expect(out).toContain('"has ""quote"""');
  });
  it("returns BOM + header line when empty", () => {
    const out = toCsv([]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toContain("orderNo;");
  });
});
