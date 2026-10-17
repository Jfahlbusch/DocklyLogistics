import { describe, it, expect } from "vitest";
import { safeCallbackUrl } from "./callback-url";

describe("safeCallbackUrl", () => {
  it("lässt interne Pfade inkl. Query durch", () => {
    expect(safeCallbackUrl("/warehouse-mode?zone=z1")).toBe("/warehouse-mode?zone=z1");
  });

  it.each([null, undefined, "", "https://evil.example/x", "//evil.example", "/\\evil.example", "javascript:alert(1)", "warehouse-mode"])(
    "fällt bei %j auf /dashboard zurück",
    (raw) => {
      expect(safeCallbackUrl(raw)).toBe("/dashboard");
    },
  );
});
