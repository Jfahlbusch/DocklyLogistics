import { describe, it, expect } from "vitest";
import { withEan13Checksum, validateEan13, generateBarcode } from "./generate";

describe("withEan13Checksum", () => {
  it("computes the check digit correctly", () => {
    // 4006381333931 — Weizenmehl Type 550 EAN
    expect(withEan13Checksum("400638133393")).toBe("4006381333931");
  });
  it("throws on non-12-digit input", () => {
    expect(() => withEan13Checksum("123")).toThrow();
    expect(() => withEan13Checksum("12345678901a")).toThrow();
  });
});

describe("validateEan13", () => {
  it("accepts valid EAN-13", () => {
    expect(validateEan13("4006381333931")).toBe(true);
  });
  it("rejects invalid check digit", () => {
    expect(validateEan13("4006381333930")).toBe(false);
  });
  it("rejects non-13-digit", () => {
    expect(validateEan13("123")).toBe(false);
  });
});

describe("generateBarcode", () => {
  it("generates Code-128 from SKU", async () => {
    const r = await generateBarcode({ format: "code128", source: "SKU", sku: "MEHL-550-25" });
    expect(r.value).toBe("MEHL-550-25");
    expect(r.svg.length).toBeGreaterThan(100);
    expect(r.pngBase64.length).toBeGreaterThan(100);
  });
  it("generates EAN-13 from 12-digit EAN with auto-checksum", async () => {
    const r = await generateBarcode({
      format: "ean13", source: "EAN", sku: "irrelevant", eanGtin: "400638133393",
    });
    expect(r.value).toBe("4006381333931");
  });
  it("rejects EAN-13 with invalid check digit", async () => {
    await expect(generateBarcode({
      format: "ean13", source: "EAN", sku: "irrelevant", eanGtin: "4006381333930",
    })).rejects.toThrow();
  });
});
