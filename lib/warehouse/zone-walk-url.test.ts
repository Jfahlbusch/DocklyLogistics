import { describe, it, expect } from "vitest";
import { zoneWalkUrl } from "./zone-walk-url";

describe("zoneWalkUrl", () => {
  it("baut die Rundgang-URL", () => {
    expect(zoneWalkUrl("https://logistics.dockly.de", "abc123")).toBe(
      "https://logistics.dockly.de/warehouse-mode?zone=abc123",
    );
  });
  it("entfernt abschließende Slashes der Basis", () => {
    expect(zoneWalkUrl("https://logistics.dockly.de/", "z1")).toBe("https://logistics.dockly.de/warehouse-mode?zone=z1");
    expect(zoneWalkUrl("http://localhost:3000///", "z1")).toBe("http://localhost:3000/warehouse-mode?zone=z1");
  });
  it("kodiert die Zonen-ID", () => {
    expect(zoneWalkUrl("https://x.de", "a b&c=d/é")).toBe(
      `https://x.de/warehouse-mode?zone=${encodeURIComponent("a b&c=d/é")}`,
    );
    expect(zoneWalkUrl("https://x.de", "a&b")).not.toContain("a&b");
  });
});
