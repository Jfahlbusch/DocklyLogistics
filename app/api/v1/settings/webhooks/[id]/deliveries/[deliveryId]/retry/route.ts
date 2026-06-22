import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { webhookRepo, deliveryRepo } from "@/lib/db/repos/webhook";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";

type Ctx = { params: Promise<{ id: string; deliveryId: string }> };

/**
 * POST /api/v1/settings/webhooks/{id}/deliveries/{deliveryId}/retry
 *
 * Re-queues a FAILED or GIVEN_UP delivery for another attempt (the worker only
 * picks up PENDING/FAILED-due, so a given-up delivery is otherwise dead). MANAGER.
 */
export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const { id, deliveryId } = await params;

  const wh = await webhookRepo.findById(ctx.tenantId, id);
  if (!wh) return fail(404, "Webhook not found");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const delivery = await prisma.$transaction(async (tx) => {
    const r = await deliveryRepo.requeue(tx, { tenantId: ctx.tenantId, webhookId: id, deliveryId });
    if (r.count === 0) return null;
    await appendAudit(tx, {
      tenantId: ctx.tenantId,
      entity: "WebhookDelivery",
      entityId: deliveryId,
      action: "UPDATE",
      actorId,
      actorEmail,
      after: { action: "retry", status: "PENDING" },
    });
    return tx.webhookDelivery.findFirst({ where: { id: deliveryId, tenantId: ctx.tenantId } });
  });

  if (!delivery) {
    return fail(409, "Delivery nicht gefunden oder nicht im Status FAILED/GIVEN_UP — Retry nicht möglich.");
  }

  return ok({
    requeued: true,
    delivery: {
      id: delivery.id,
      status: delivery.status,
      attempts: delivery.attempts,
      nextAttemptAt: delivery.nextAttemptAt,
    },
  });
});
