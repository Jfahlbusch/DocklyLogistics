import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { publicHandler } from "@/lib/api/public-handler";
import { authenticatePublic, PublicAuthError } from "@/lib/api/public-auth";
import { orderService, OrderStatusError } from "@/lib/services/order-service";
import { appendAudit } from "@/lib/audit/append";
import { ok, fail } from "@/lib/api/respond";
import { PublicOrderConfirmSchema } from "@/lib/schemas/public-api";

type Ctx = { params: Promise<{ id: string }> };

export const POST = publicHandler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await authenticatePublic(req.headers, "orders:confirm");
  const { id } = await params;
  const body = PublicOrderConfirmSchema.parse(await req.json().catch(() => ({})));

  const order = await prisma.order.findFirst({
    where: { tenantId: ctx.tenantId, id, supplierId: ctx.supplierId },
  });
  if (!order) {
    throw new PublicAuthError(404, "Not Found", "Bestellung gehört nicht zu deinem Account");
  }
  if (!["SENT", "PARTIALLY_RECEIVED"].includes(order.status)) {
    return fail(409, "Status erlaubt keine Bestätigung", `Aktueller Status: ${order.status}`);
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const u = await orderService.transition(tx, {
        orderId: id,
        to: "CONFIRMED",
        actorId: `apikey:${ctx.apiKeyId}`,
        actorEmail: `api:${ctx.prefix}`,
        ip: req.headers.get("x-forwarded-for") ?? undefined,
        eventType: "STATUS_CHANGED",
        payload: {
          source: "public-api",
          supplierName: ctx.supplierName,
          acknowledgement: body.acknowledgement ?? null,
          expectedDeliveryAt: body.expectedDeliveryAt ?? null,
        },
        extraData: { confirmedAt: new Date() },
      });
      await appendAudit(tx, {
        tenantId: ctx.tenantId,
        entity: "Order",
        entityId: id,
        action: "STATUS_CHANGE",
        actorId: `apikey:${ctx.apiKeyId}`,
        actorEmail: `api:${ctx.prefix}`,
        before: { status: order.status },
        after: { status: "CONFIRMED", source: "public-api" },
      });
      return u;
    });
    return ok({
      id: updated.id,
      orderNo: updated.orderNo,
      status: updated.status,
      confirmedAt: updated.confirmedAt,
    });
  } catch (e) {
    if (e instanceof OrderStatusError) return fail(409, "Transition nicht erlaubt", e.message);
    throw e;
  }
});
