import { NextResponse, type NextRequest } from "next/server";
import { renderOrderPdfBuffer, type OrderPdfData } from "@/lib/pdf/order-pdf";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { tenantPdfSettingsRepo } from "@/lib/db/repos/tenant-pdf-settings";

/**
 * GET /api/v1/settings/pdf/preview — sample order slip rendered with the tenant's
 * saved branding, so the settings page can show the result. Dummy order data.
 */
export const GET = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const branding = await tenantPdfSettingsRepo.get(ctx.tenantId);

  const data: OrderPdfData = {
    orderNo: "MUSTER-0001",
    createdAt: new Date(),
    currency: "EUR",
    notes: "Dies ist eine Vorschau – keine echte Bestellung.",
    total: "1.234,56",
    sender: { fromName: "Ihr Unternehmen", fromEmail: "einkauf@example.de", signature: "Mit freundlichen Grüßen" },
    supplier: {
      name: "Beispiel-Lieferant GmbH", contactName: "Max Muster", street: "Musterstraße 1",
      postalCode: "12345", city: "Musterstadt", country: "DE", email: "kontakt@lieferant.de",
    },
    items: [
      { sku: "ART-001", name: "Beispielartikel A", qtyOrderUnit: 4, orderUnit: "SACK", unitPrice: "12,50", lineTotal: "50,00" },
      { sku: "ART-002", name: "Beispielartikel B", qtyOrderUnit: 2, orderUnit: "KARTON", unitPrice: "8,00", lineTotal: "16,00" },
    ],
    hashShort: "vorschau",
    branding,
  };

  const buffer = await renderOrderPdfBuffer(data);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="bestellschein-vorschau.pdf"',
      "Cache-Control": "no-store",
    },
  });
});
