import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { orderService, OrderStatusError } from "@/lib/services/order-service";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findFirst({ where: { tenantId: ctx.tenantId, id } });
      if (!existing) throw new OrderStatusError("Not Found");
      const u = await orderService.transition(tx, {
        orderId: id, to: "APPROVED",
        actorId, actorEmail, eventType: "STATUS_CHANGED",
        payload: { from: existing.status },
      });
      await appendAudit(tx, {
        tenantId: ctx.tenantId, entity: "Order", entityId: id, action: "STATUS_CHANGE",
        actorId, actorEmail,
        before: { status: existing.status }, after: { status: "APPROVED" },
      });
      return u;
    });
    return ok(updated);
  } catch (e) {
    if (e instanceof OrderStatusError) return fail(e.message === "Not Found" ? 404 : 409, e.message);
    throw e;
  }
});
