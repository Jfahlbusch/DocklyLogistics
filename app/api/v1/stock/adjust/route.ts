import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { stockRepo, InsufficientStockError } from "@/lib/db/repos/stock";
import { articleRepo } from "@/lib/db/repos/article";
import { storageLocationRepo } from "@/lib/db/repos/storage-location";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";
import { StockAdjustSchema } from "@/lib/schemas/stock";

export const POST = handler(async (req: NextRequest) => {
  const ctx = requireRoleFromHeaders(req.headers, "USER");
  const body = StockAdjustSchema.parse(await req.json());

  const article = await articleRepo.findById(ctx.tenantId, body.articleId);
  if (!article) return fail(404, "Article not found");
  const location = await storageLocationRepo.findById(ctx.tenantId, body.locationId);
  if (!location) return fail(404, "Location not found");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const r = await stockRepo.applyDelta(tx, {
        tenantId: ctx.tenantId,
        articleId: body.articleId,
        locationId: body.locationId,
        delta: body.delta,
        reason: body.reason,
        note: body.note,
        createdBy: actorEmail,
      });
      await appendAudit(tx, {
        tenantId: ctx.tenantId,
        entity: "StockMovement",
        entityId: r.movement.id,
        action: "CREATE",
        actorId,
        actorEmail,
        ip: req.headers.get("x-forwarded-for") ?? undefined,
        userAgent: req.headers.get("user-agent") ?? undefined,
        after: {
          articleSku: article.sku,
          locationCode: location.code,
          delta: body.delta,
          reason: body.reason,
          newBalance: r.balance.quantity,
        },
      });
      return r;
    });

    return ok({ balance: result.balance, movement: result.movement });
  } catch (e) {
    if (e instanceof InsufficientStockError) return fail(422, "Insufficient stock", e.message);
    throw e;
  }
});
