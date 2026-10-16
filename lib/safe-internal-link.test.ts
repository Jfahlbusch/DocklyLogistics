import { describe, it, expect } from "vitest";
import { safeInternalLink } from "./safe-internal-link";

const ORIGIN = "https://logistics.dockly.de";

describe("safeInternalLink", () => {
  it.each([
    ["/edi", "/edi"],
    ["/orders?id=1#x", "/orders?id=1#x"],
    ["/articles/ab%20c", "/articles/ab%20c"],
  ])("lässt den app-relativen Pfad %s durch", (link, erwartet) => {
    expect(safeInternalLink(link, ORIGIN)).toBe(erwartet);
  });

  it.each([
    "//evil.example/x",
    "/\\evil.example/x",          // Backslash gilt im Browser als Schrägstrich
    "/\t/evil.example/x",          // Tab wird vom URL-Parser entfernt → //evil
    "/\n/evil.example/x",
    "\\\\evil.example",
    "https://evil.example/x",
    "javascript:alert(1)",
    "edi",                          // relativ ohne führenden Schrägstrich
    "",
  ])("weist %j ab", (link) => {
    expect(safeInternalLink(link, ORIGIN)).toBeNull();
  });

  it("weist null ab", () => {
    expect(safeInternalLink(null, ORIGIN)).toBeNull();
  });
});
