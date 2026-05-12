import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok } from "@/lib/api/respond";
import { BulkConfirmSchema } from "@/lib/schemas/order-suggestion";

export const POST = handler(async (req: NextRequest) => {
  const ctx = requireRoleFromHeaders(req.headers, "USER");
  const body = BulkConfirmSchema.parse(await req.json());

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  let confirmed = 0;
  let skipped = 0;
  await prisma.$transaction(async (tx) => {
    for (const id of body.ids) {
      const existing = await tx.orderSuggestion.findFirst({
        where: { tenantId: ctx.tenantId, id },
      });
      if (!existing || existing.status !== "PENDING") {
        skipped++;
        continue;
      }
      await tx.orderSuggestion.update({ where: { id }, data: { status: "CONFIRMED" } });
      await appendAudit(tx, {
        tenantId: ctx.tenantId,
        entity: "OrderSuggestion",
        entityId: id,
        action: "STATUS_CHANGE",
        actorId,
        actorEmail,
        ip: req.headers.get("x-forwarded-for") ?? undefined,
        userAgent: req.headers.get("user-agent") ?? undefined,
        before: { status: existing.status },
        after: { status: "CONFIRMED", bulk: true },
      });
      confirmed++;
    }
  });

  return ok({ confirmed, skipped });
});
