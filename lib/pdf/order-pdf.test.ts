import { describe, it, expect } from "vitest";
import { writeFileSync } from "fs";
import { renderOrderPdfBuffer } from "./order-pdf";

describe("renderOrderPdfBuffer", () => {
  it("renders a valid, non-trivial PDF for an order", async () => {
    const buf = await renderOrderPdfBuffer({
      orderNo: "BST-2026-0001",
      createdAt: new Date("2026-06-23T10:00:00Z"),
      currency: "EUR",
      notes: "Bitte morgens vor 8 Uhr liefern.",
      total: "1.234,56",
      sender: { fromName: "Bäckerei Muster GmbH", fromEmail: "einkauf@muster.de", signature: "Mit freundlichen Grüßen, Team Einkauf" },
      supplier: {
        name: "Mühle Schmidt", contactName: "Herr Schmidt", street: "Mühlweg 1",
        postalCode: "12345", city: "Musterstadt", country: "DE", email: "info@muehle.de",
      },
      items: [
        { sku: "MEHL-405", name: "Weizenmehl Type 405", qtyOrderUnit: 4, orderUnit: "SACK", unitPrice: "12,50", lineTotal: "50,00" },
        { sku: "ZUCK-01", name: "Zucker raffiniert", qtyOrderUnit: 2, orderUnit: "SACK", unitPrice: "8,00", lineTotal: "16,00" },
      ],
      hashShort: "abc123def456",
    });
    expect(buf.length).toBeGreaterThan(2000);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("renders with per-tenant branding (logo + header + footer)", async () => {
    const buf = await renderOrderPdfBuffer({
      orderNo: "BST-2026-0002",
      createdAt: new Date("2026-06-23T10:00:00Z"),
      currency: "EUR",
      notes: null,
      total: "99,00",
      sender: { fromName: "Mandant GmbH" },
      supplier: { name: "Lieferant" },
      items: [{ sku: "X", name: "Artikel", qtyOrderUnit: 1, orderUnit: "STK", unitPrice: "99,00", lineTotal: "99,00" }],
      hashShort: "branded",
      branding: {
        logoDataUri:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        headerText: "Musterstraße 1\n12345 Musterstadt",
        footerText: "Bank: DE12 3456 · USt-IdNr.: DE999999999",
      },
    });
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    if (process.env.WRITE_PDF) writeFileSync(process.env.WRITE_PDF, buf);
  });
});
