import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { orderService, OrderStatusError } from "@/lib/services/order-service";
import { appendAudit } from "@/lib/audit/append";
import { emitEvent } from "@/lib/services/webhook-emit";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";
import { OrderCancelSchema } from "@/lib/schemas/order";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;
  const body = OrderCancelSchema.parse(await req.json().catch(() => ({})));

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findFirst({ where: { tenantId: ctx.tenantId, id } });
      if (!existing) throw new OrderStatusError("Not Found");
      const u = await orderService.transition(tx, {
        orderId: id, to: "CANCELLED",
        actorId, actorEmail, eventType: "CANCEL",
        payload: { reason: body.reason ?? null, from: existing.status },
        extraData: { cancelledAt: new Date() },
      });
      await appendAudit(tx, {
        tenantId: ctx.tenantId, entity: "Order", entityId: id, action: "CANCEL",
        actorId, actorEmail,
        before: { status: existing.status }, after: { status: "CANCELLED", reason: body.reason ?? null },
      });
      await emitEvent(tx, ctx.tenantId, "order.cancelled", {
        orderId: id,
        orderNo: existing.orderNo,
        supplierId: existing.supplierId,
        reason: body.reason ?? null,
        from: existing.status,
      });
      return u;
    });
    return ok(updated);
  } catch (e) {
    if (e instanceof OrderStatusError) return fail(e.message === "Not Found" ? 404 : 409, e.message);
    throw e;
  }
});
