import { describe, it, expect } from "vitest";
import { generateOrdersEdifact, formatEdiNumber } from "./generate-orders";
import { parseInterchange } from "./edifact";
import { classifyInbound } from "./inbound";

const BASE = {
  orderNo: "DEMO-2026-0042",
  currency: "EUR",
  orderDate: new Date(Date.UTC(2026, 6, 1, 9, 30)),
  sender: { id: "4098765000004", qualifier: "14" },
  recipient: { id: "4012345000009", qualifier: "14" },
  refs: { interchangeRef: "IC42", messageRef: "ME42" },
  items: [
    { sku: "MEHL-W550-25", name: "Weizenmehl Type 550", ean: "4011200550251", qtyOrderUnit: 8, orderUnit: "SACK", unitPrice: 16.9 },
    { sku: "HONIG-EI-25", name: "Blütenhonig + Deckel: 25kg?", ean: null, qtyOrderUnit: 2, orderUnit: "PACK", unitPrice: 119 },
  ],
};

describe("generateOrdersEdifact", () => {
  it("emits a structurally valid ORDERS with correct UNT count", () => {
    const g = generateOrdersEdifact(BASE);
    const lines = g.payload.split("\n");
    expect(lines[0]).toBe("UNA:+.? '");
    expect(lines[1]).toBe("UNB+UNOC:3+4098765000004:14+4012345000009:14+260701:0930+IC42'");
    expect(g.payload).toContain("BGM+220+DEMO-2026-0042+9'");
    expect(g.payload).toContain("DTM+137:20260701:102'");
    expect(g.payload).toContain("LIN+1++4011200550251:EN'");
    expect(g.payload).toContain("PIA+5+MEHL-W550-25:SA'");
    expect(g.payload).toContain("LIN+2++HONIG-EI-25:SA'");
    expect(g.payload).toContain("QTY+21:8:SA'");
    expect(g.payload).toContain("PRI+AAA:16.9'");
    expect(g.payload).toContain("CNT+2:2'");

    // UNT value must equal segment count UNH..UNT inclusive
    const msgSegs = lines.filter((l) => !/^(UNA|UNB|UNZ)/.test(l));
    expect(g.payload).toContain(`UNT+${msgSegs.length}+ME42'`);
    expect(g.segmentCount).toBe(msgSegs.length);
  });

  it("escapes special characters in item names", () => {
    const g = generateOrdersEdifact(BASE);
    expect(g.payload).toContain("Blütenhonig ?+ Deckel?: 25kg??");
  });

  it("round-trips through the parser", () => {
    const g = generateOrdersEdifact(BASE);
    const p = parseInterchange(g.payload);
    expect(p.messages).toHaveLength(1);
    expect(p.messages[0].type).toBe("ORDERS");
    expect(p.envelope?.interchangeRef).toBe("IC42");
    const unt = p.messages[0].segments.at(-1);
    expect(unt?.tag).toBe("UNT");
    expect(unt?.elements[0]?.[0]).toBe(String(p.messages[0].segments.length));
  });
});

describe("formatEdiNumber", () => {
  it("renders plain decimals without trailing zeros", () => {
    expect(formatEdiNumber(16.9)).toBe("16.9");
    expect(formatEdiNumber(119)).toBe("119");
    expect(formatEdiNumber(0.1234)).toBe("0.1234");
  });
});

describe("classifyInbound", () => {
  it("maps generated ORDERS back to structured lines (roundtrip)", () => {
    const g = generateOrdersEdifact(BASE);
    const c = classifyInbound(g.payload);
    expect(c.kind).toBe("ORDERS");
    if (c.kind !== "ORDERS") return;
    expect(c.data.documentNo).toBe("DEMO-2026-0042");
    expect(c.data.buyerId).toBe("4098765000004");
    expect(c.data.supplierId).toBe("4012345000009");
    expect(c.data.currency).toBe("EUR");
    expect(c.data.lines).toHaveLength(2);
    expect(c.data.lines[0]).toMatchObject({ ean: "4011200550251", sku: "MEHL-W550-25", qty: 8, unit: "SA", price: 16.9 });
    expect(c.data.lines[1]).toMatchObject({ sku: "HONIG-EI-25", qty: 2, price: 119 });
    expect(c.data.lines[1].name).toBe("Blütenhonig + Deckel: 25kg?");
  });

  it("maps an ORDRSP confirmation", () => {
    const raw =
      "UNB+UNOC:3+4012345000009:14+4098765000004:14+260702:0800+ICR1'" +
      "UNH+MR1+ORDRSP:D:96A:UN'" +
      "BGM+231+CONF-77+29'" +
      "RFF+ON:DEMO-2026-0042'" +
      "UNT+4+MR1'" +
      "UNZ+1+ICR1'";
    const c = classifyInbound(raw);
    expect(c.kind).toBe("ORDRSP");
    if (c.kind !== "ORDRSP") return;
    expect(c.data.orderReference).toBe("DEMO-2026-0042");
    expect(c.data.responseCode).toBe("29");
    expect(c.data.senderId).toBe("4012345000009");
  });

  it("classifies unknown message types", () => {
    const raw =
      "UNB+UNOC:3+A:14+B:14+260701:0800+X9'" +
      "UNH+M9+INVOIC:D:96A:UN'" +
      "BGM+380+RE-1'" +
      "UNT+3+M9'" +
      "UNZ+1+X9'";
    const c = classifyInbound(raw);
    expect(c.kind).toBe("UNKNOWN");
    if (c.kind === "UNKNOWN") expect(c.messageType).toBe("INVOIC");
  });
});
