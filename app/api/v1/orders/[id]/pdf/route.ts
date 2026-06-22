import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { renderOrderPdfBuffer, type OrderPdfData } from "@/lib/pdf/order-pdf";
import { tenantChannelRepo } from "@/lib/db/repos/tenant-channel";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { fail } from "@/lib/api/respond";

type Ctx = { params: Promise<{ id: string }> };

function formatDec(n: unknown): string {
  return Number(n).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const GET = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { tenantId: ctx.tenantId, id },
    include: { supplier: true, items: { include: { article: true } } },
  });
  if (!order) return fail(404, "Not Found");

  const tenantCfg = await tenantChannelRepo.findDefault(ctx.tenantId, order.supplier.channel);
  const senderCfg = (tenantCfg?.config ?? {}) as { fromEmail?: string; fromName?: string; signature?: string };

  const data: OrderPdfData = {
    orderNo: order.orderNo,
    createdAt: order.createdAt,
    currency: order.currency,
    notes: order.notes,
    total: formatDec(order.total),
    sender: { fromName: senderCfg.fromName ?? "DocklyLogistics", fromEmail: senderCfg.fromEmail, signature: senderCfg.signature },
    supplier: {
      name: order.supplier.name,
      contactName: order.supplier.contactName,
      street: order.supplier.street,
      postalCode: order.supplier.postalCode,
      city: order.supplier.city,
      country: order.supplier.country,
      email: order.supplier.email,
    },
    items: order.items.map((it) => ({
      sku: it.article.sku, name: it.article.name,
      qtyOrderUnit: it.qtyOrderUnit, orderUnit: it.article.orderUnit,
      unitPrice: formatDec(it.unitPrice),
      lineTotal: formatDec(it.lineTotal),
    })),
    hashShort: order.pdfHash ? order.pdfHash.slice(0, 12) : "—",
  };

  const buffer = await renderOrderPdfBuffer(data);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${order.orderNo}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});
