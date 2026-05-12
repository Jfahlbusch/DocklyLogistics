import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { orderRepo } from "@/lib/db/repos/order";
import { orderService } from "@/lib/services/order-service";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, created } from "@/lib/api/respond";
import { OrderCreateSchema, OrderListQuerySchema } from "@/lib/schemas/order";

export const GET = handler(async (req: NextRequest) => {
  const ctx = requireRoleFromHeaders(req.headers, "VIEWER");
  const query = OrderListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const { items, total } = await orderRepo.list({ tenantId: ctx.tenantId, ...query });
  return ok(items, { page: query.page, pageSize: query.pageSize, total });
});

export const POST = handler(async (req: NextRequest) => {
  const ctx = requireRoleFromHeaders(req.headers, "USER");
  const body = OrderCreateSchema.parse(await req.json());

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const order = await prisma.$transaction(async (tx) => {
    const o = await orderService.create(tx, {
      tenantId: ctx.tenantId,
      supplierId: body.supplierId,
      currency: body.currency,
      notes: body.notes,
      items: body.items,
      createdBy: actorEmail,
      actorId, actorEmail,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    await appendAudit(tx, {
      tenantId: ctx.tenantId, entity: "Order", entityId: o.id, action: "CREATE",
      actorId, actorEmail,
      after: { orderNo: o.orderNo, supplierId: body.supplierId, items: body.items.length },
    });
    return o;
  });

  return created(order);
});
