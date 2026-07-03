import { describe, it, expect } from "vitest";
import { renderOrderXml, escapeXml } from "./order-xml";

describe("escapeXml", () => {
  it("escapes all five XML entities", () => {
    expect(escapeXml(`Müller & Söhne <"'>`)).toBe("Müller &amp; Söhne &lt;&quot;&apos;&gt;");
  });
  it("strips control characters", () => {
    expect(escapeXml("a" + String.fromCharCode(7) + "bc")).toBe("abc");
  });
});

describe("renderOrderXml", () => {
  const xml = renderOrderXml({
    documentNo: "KD-2026-0815",
    orderDate: "20260703",
    currency: "EUR",
    buyerId: "4111111000005",
    supplierId: "4170000041474",
    source: "edi-inbound",
    lines: [
      { lineNo: 1, ean: "4012345678901", sku: "MEHL-1", name: "Weizenmehl & Co.", qty: 12, unit: "SA", price: 15.9 },
      { lineNo: 2, sku: "ZUCK-1", name: "Zucker", qty: 4, unit: "SA", price: 24 },
    ],
  });

  it("emits a valid declaration, header and lines", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<DocumentNo>KD-2026-0815</DocumentNo>");
    expect(xml).toContain("<BuyerId>4111111000005</BuyerId>");
    expect(xml).toContain('<Line number="1">');
    expect(xml).toContain("<EAN>4012345678901</EAN>");
    expect(xml).toContain("<Name>Weizenmehl &amp; Co.</Name>");
    expect(xml).toContain("<Quantity>12</Quantity>");
    expect(xml).toContain("<Price>15.9</Price>");
  });

  it("omits empty fields (line 2 has no EAN)", () => {
    const line2 = xml.slice(xml.indexOf('<Line number="2"'));
    expect(line2).not.toContain("<EAN>");
    expect(line2).toContain("<SKU>ZUCK-1</SKU>");
  });

  it("defaults currency to EUR when absent", () => {
    const x = renderOrderXml({ documentNo: "X", lines: [] });
    expect(x).toContain("<Currency>EUR</Currency>");
  });
});
