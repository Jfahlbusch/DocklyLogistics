import { describe, it, expect } from "vitest";
import { escapeComponent, seg, parseInterchange, findSeg } from "./edifact";

describe("escapeComponent", () => {
  it("escapes all service characters with the release char", () => {
    expect(escapeComponent("Mehl+Zucker:50%?'")).toBe("Mehl?+Zucker?:50%???'");
  });
  it("replaces newlines with spaces", () => {
    expect(escapeComponent("Zeile1\nZeile2")).toBe("Zeile1 Zeile2");
  });
});

describe("seg", () => {
  it("joins elements and components with service chars", () => {
    expect(seg("UNH", ["REF1", ["ORDERS", "D", "96A", "UN"]])).toBe("UNH+REF1+ORDERS:D:96A:UN'");
  });
  it("trims trailing empty elements but keeps embedded ones", () => {
    expect(seg("LIN", ["1", "", ["4012345678901", "EN"], "", ""])).toBe("LIN+1++4012345678901:EN'");
  });
  it("keeps positional empty components", () => {
    expect(seg("NAD", ["BY", ["4098765000004", "", "9"]])).toBe("NAD+BY+4098765000004::9'");
  });
});

describe("parseInterchange", () => {
  const raw =
    "UNA:+.? '\n" +
    "UNB+UNOC:3+4098765000004:14+4012345000009:14+260701:0930+IC1'\n" +
    "UNH+ME1+ORDERS:D:96A:UN'\n" +
    "BGM+220+DEMO-2026-0001+9'\n" +
    "IMD+F++:::Mehl ?+ Zucker'\n" +
    "UNT+4+ME1'\n" +
    "UNZ+1+IC1'";

  it("reads the UNA header and envelope", () => {
    const p = parseInterchange(raw);
    expect(p.envelope?.senderId).toBe("4098765000004");
    expect(p.envelope?.recipientId).toBe("4012345000009");
    expect(p.envelope?.interchangeRef).toBe("IC1");
  });

  it("splits messages and unescapes components", () => {
    const p = parseInterchange(raw);
    expect(p.messages).toHaveLength(1);
    expect(p.messages[0].type).toBe("ORDERS");
    const imd = findSeg(p.messages[0].segments, "IMD");
    expect(imd?.elements[2]?.[3]).toBe("Mehl + Zucker");
  });

  it("honours a custom UNA (e.g. '|' as segment terminator)", () => {
    const custom = "UNA:+.? |UNB+UNOC:3+A:14+B:14+260701:0930+X1|UNH+M+ORDERS:D:96A:UN|UNT+2+M|UNZ+1+X1|";
    const p = parseInterchange(custom);
    expect(p.envelope?.interchangeRef).toBe("X1");
    expect(p.messages[0].type).toBe("ORDERS");
  });

  it("throws on empty input", () => {
    expect(() => parseInterchange("   ")).toThrow();
  });
});
