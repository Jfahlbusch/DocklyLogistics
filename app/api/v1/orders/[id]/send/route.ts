import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { orderService, OrderStatusError } from "@/lib/services/order-service";
import { tenantChannelRepo } from "@/lib/db/repos/tenant-channel";
import { renderOrderPdfBuffer, type OrderPdfData } from "@/lib/pdf/order-pdf";
import { dispatchOrder } from "@/lib/channels";
import { appendAudit } from "@/lib/audit/append";
import { emitEvent } from "@/lib/services/webhook-emit";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";

type Ctx = { params: Promise<{ id: string }> };

function formatDec(n: unknown): string {
  return Number(n).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  // Load order with supplier + items
  const order = await prisma.order.findFirst({
    where: { tenantId: ctx.tenantId, id },
    include: {
      supplier: true,
      items: { include: { article: true } },
    },
  });
  if (!order) return fail(404, "Not Found");
  if (order.status !== "APPROVED") return fail(409, `Order is not in APPROVED status (current: ${order.status})`);

  // Tenant-channel config (sender identity)
  const tenantCfg = await tenantChannelRepo.findDefault(ctx.tenantId, order.supplier.channel);
  if (!tenantCfg) return fail(422, `Kein Versandprofil für Kanal ${order.supplier.channel} im Tenant konfiguriert`);

  // Build PDF data
  const senderCfg = (tenantCfg.config ?? {}) as { fromEmail?: string; fromName?: string; signature?: string };
  const pdfData: OrderPdfData = {
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
    hashShort: "M6-pending",
  };

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderOrderPdfBuffer(pdfData);
  } catch (e) {
    return fail(500, "PDF generation failed", (e as Error).message);
  }

  const pdfHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

  // Dispatch via channel
  const result = await dispatchOrder({ order, tenantCfg, pdfBuffer });
  if (!result.ok) {
    return fail(422, "Channel dispatch failed", result.message);
  }

  // Transition to SENT
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const u = await orderService.transition(tx, {
        orderId: id, to: "SENT",
        actorId, actorEmail, eventType: "SEND",
        payload: { channel: order.supplier.channel, dispatch: result.message, details: result.details },
        extraData: { sentAt: new Date(), pdfHash, pdfPath: result.details?.mockPath ? String(result.details.mockPath) : null },
      });
      await appendAudit(tx, {
        tenantId: ctx.tenantId, entity: "Order", entityId: id, action: "SEND",
        actorId, actorEmail,
        before: { status: "APPROVED" },
        after: { status: "SENT", channel: order.supplier.channel, pdfHash },
      });
      await emitEvent(tx, ctx.tenantId, "order.sent", {
        orderId: id,
        orderNo: order.orderNo,
        supplierId: order.supplier.id,
        total: Number(order.total),
      });
      return u;
    });
    return ok({ order: updated, dispatch: result });
  } catch (e) {
    if (e instanceof OrderStatusError) return fail(409, e.message);
    throw e;
  }
});
