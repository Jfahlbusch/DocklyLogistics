import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { orderSuggestionRepo } from "@/lib/db/repos/order-suggestion";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";
import { OrderSuggestionUpdateSchema } from "@/lib/schemas/order-suggestion";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = requireRoleFromHeaders(req.headers, "USER");
  const { id } = await params;
  const body = OrderSuggestionUpdateSchema.parse(await req.json());

  const existing = await orderSuggestionRepo.findById(ctx.tenantId, id);
  if (!existing) return fail(404, "Not Found");
  if (existing.status !== "PENDING") return fail(409, "Suggestion is no longer PENDING");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const updated = await prisma.$transaction(async (tx) => {
    const u = await orderSuggestionRepo.update(tx, id, body);
    await appendAudit(tx, {
      tenantId: ctx.tenantId,
      entity: "OrderSuggestion",
      entityId: id,
      action: "UPDATE",
      actorId,
      actorEmail,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
      before: { supplierId: existing.supplierId, qty: existing.qtyOrderUnit },
      after: { supplierId: u.supplierId, qty: u.qtyOrderUnit },
    });
    return u;
  });

  return ok(updated);
});
