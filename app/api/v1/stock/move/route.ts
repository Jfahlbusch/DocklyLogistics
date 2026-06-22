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
import { StockMoveSchema } from "@/lib/schemas/stock";
import { ulid } from "@/lib/utils/ulid";

export const POST = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "USER");
  const body = StockMoveSchema.parse(await req.json());

  if (body.fromLocationId === body.toLocationId) return fail(422, "From and to location must differ");

  const article = await articleRepo.findById(ctx.tenantId, body.articleId);
  if (!article) return fail(404, "Article not found");
  const from = await storageLocationRepo.findById(ctx.tenantId, body.fromLocationId);
  if (!from) return fail(404, "From-location not found");
  const to = await storageLocationRepo.findById(ctx.tenantId, body.toLocationId);
  if (!to) return fail(404, "To-location not found");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;
  const transferId = ulid();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const out = await stockRepo.applyDelta(tx, {
        tenantId: ctx.tenantId,
        articleId: body.articleId,
        locationId: body.fromLocationId,
        delta: -body.quantity,
        reason: "MOVE_OUT",
        refType: "TRANSFER",
        refId: transferId,
        note: body.note,
        createdBy: actorEmail,
      });
      const inn = await stockRepo.applyDelta(tx, {
        tenantId: ctx.tenantId,
        articleId: body.articleId,
        locationId: body.toLocationId,
        delta: body.quantity,
        reason: "MOVE_IN",
        refType: "TRANSFER",
        refId: transferId,
        note: body.note,
        createdBy: actorEmail,
      });

      await appendAudit(tx, {
        tenantId: ctx.tenantId,
        entity: "StockMovement",
        entityId: transferId,
        action: "CREATE",
        actorId,
        actorEmail,
        ip: req.headers.get("x-forwarded-for") ?? undefined,
        userAgent: req.headers.get("user-agent") ?? undefined,
        after: {
          articleSku: article.sku,
          from: from.code,
          to: to.code,
          quantity: body.quantity,
          transferId,
        },
      });

      return { out, in: inn };
    });

    return ok({ transferId, out: result.out, in: result.in });
  } catch (e) {
    if (e instanceof InsufficientStockError) return fail(422, "Insufficient stock", e.message);
    throw e;
  }
});
