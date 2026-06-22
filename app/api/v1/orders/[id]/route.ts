import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { orderRepo } from "@/lib/db/repos/order";
import { orderService } from "@/lib/services/order-service";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";
import { OrderUpdateSchema } from "@/lib/schemas/order";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const { id } = await params;
  const o = await orderRepo.findById(ctx.tenantId, id);
  if (!o) return fail(404, "Not Found");
  return ok(o);
});

export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "USER");
  const { id } = await params;
  const body = OrderUpdateSchema.parse(await req.json());

  const existing = await orderRepo.findByIdMinimal(ctx.tenantId, id);
  if (!existing) return fail(404, "Not Found");
  if (existing.status !== "DRAFT" && existing.status !== "REVIEW") {
    return fail(409, "Cannot edit order in this status", `Status ${existing.status}`);
  }

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const updated = await prisma.$transaction(async (tx) => {
    let newTotal = Number(existing.total);
    if (body.items) {
      const enriched = await orderService.enrichItems(tx, body.items);
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      for (const it of enriched.items) {
        await tx.orderItem.create({ data: { orderId: id, ...it } });
      }
      newTotal = enriched.total;
    }
    const u = await tx.order.update({
      where: { id },
      data: {
        ...(body.currency !== undefined ? { currency: body.currency } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.items ? { total: newTotal } : {}),
      },
    });
    await orderService.recordEvent(tx, {
      orderId: id, type: "UPDATE",
      actorId, actorEmail,
      payload: { fields: Object.keys(body), itemCount: body.items?.length },
    });
    await appendAudit(tx, {
      tenantId: ctx.tenantId, entity: "Order", entityId: id, action: "UPDATE",
      actorId, actorEmail,
      before: { notes: existing.notes, total: Number(existing.total) },
      after: { notes: u.notes, total: Number(u.total) },
    });
    return u;
  });

  return ok(updated);
});
