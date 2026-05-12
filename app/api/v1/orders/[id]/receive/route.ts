import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { orderService, OrderStatusError } from "@/lib/services/order-service";
import { stockRepo } from "@/lib/db/repos/stock";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";
import { OrderReceiveSchema } from "@/lib/schemas/order";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = requireRoleFromHeaders(req.headers, "USER");
  const { id } = await params;
  const body = OrderReceiveSchema.parse(await req.json());

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const order = await prisma.order.findFirst({
    where: { tenantId: ctx.tenantId, id },
    include: { items: { include: { article: true } } },
  });
  if (!order) return fail(404, "Not Found");

  if (!["SENT", "CONFIRMED", "PARTIALLY_RECEIVED"].includes(order.status)) {
    return fail(409, `Order status ${order.status} does not allow receipt`);
  }

  // Validate item ids belong to the order
  const itemMap = new Map(order.items.map((it) => [it.id, it]));
  for (const r of body.items) {
    if (!itemMap.has(r.itemId)) return fail(422, `OrderItem ${r.itemId} not found in this order`);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const movements: Array<{ itemId: string; locationCode: string; delta: number }> = [];
      // For each receive line: increase qtyReceived on OrderItem + create StockMovement + update StockBalance
      for (const r of body.items) {
        if (r.qtyBase <= 0) continue;
        const item = itemMap.get(r.itemId)!;

        // Determine target location (default = article.defaultLocationId)
        const locationId = r.locationId ?? item.article.defaultLocationId;
        if (!locationId) {
          throw new Error(`Kein Lagerplatz für Artikel ${item.article.sku} (kein defaultLocationId)`);
        }
        const location = await tx.storageLocation.findFirst({ where: { tenantId: ctx.tenantId, id: locationId } });
        if (!location) throw new Error(`Lagerplatz ${locationId} nicht gefunden`);

        await tx.orderItem.update({
          where: { id: r.itemId },
          data: { qtyReceived: { increment: r.qtyBase } },
        });

        await stockRepo.applyDelta(tx, {
          tenantId: ctx.tenantId,
          articleId: item.articleId,
          locationId,
          delta: r.qtyBase,
          reason: "RECEIPT",
          refType: "ORDER",
          refId: order.id,
          note: body.note ?? null,
          createdBy: actorEmail,
        });
        movements.push({ itemId: r.itemId, locationCode: location.code, delta: r.qtyBase });
      }

      // Recompute status: are all items fully received?
      const fresh = await tx.order.findUnique({ where: { id }, include: { items: true } });
      const fullyReceived = fresh!.items.every((it) => it.qtyReceived >= it.qtyBase);
      const nextStatus = fullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";

      const updated = await orderService.transition(tx, {
        orderId: id, to: nextStatus,
        actorId, actorEmail, eventType: "RECEIVE",
        payload: { movements, fullyReceived, note: body.note ?? null },
      });
      await appendAudit(tx, {
        tenantId: ctx.tenantId, entity: "Order", entityId: id, action: "RECEIVE",
        actorId, actorEmail,
        after: { status: nextStatus, movements },
      });
      return { order: updated, movements };
    });
    return ok(result);
  } catch (e) {
    if (e instanceof OrderStatusError) return fail(409, e.message);
    if (e instanceof Error && (e.message.startsWith("Kein Lagerplatz") || e.message.startsWith("Lagerplatz"))) return fail(422, e.message);
    throw e;
  }
});
