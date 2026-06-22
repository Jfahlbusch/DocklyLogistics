import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { orderSuggestionRepo } from "@/lib/db/repos/order-suggestion";
import { articleRepo } from "@/lib/db/repos/article";
import { supplierRepo } from "@/lib/db/repos/supplier";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, created, fail } from "@/lib/api/respond";
import {
  OrderSuggestionCreateSchema,
  OrderSuggestionListQuerySchema,
} from "@/lib/schemas/order-suggestion";

export const GET = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const query = OrderSuggestionListQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  const { items, total } = await orderSuggestionRepo.list({
    tenantId: ctx.tenantId,
    ...query,
  });
  return ok(items, { page: query.page, pageSize: query.pageSize, total });
});

export const POST = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "USER");
  const body = OrderSuggestionCreateSchema.parse(await req.json());

  const article = await articleRepo.findById(ctx.tenantId, body.articleId);
  if (!article) return fail(404, "Article not found");
  if (body.supplierId) {
    const supplier = await supplierRepo.findById(ctx.tenantId, body.supplierId);
    if (!supplier) return fail(404, "Supplier not found");
  }

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const s = await prisma.$transaction(async (tx) => {
    const sug = await orderSuggestionRepo.createManual(tx, ctx.tenantId, {
      articleId: body.articleId,
      supplierId: body.supplierId,
      qtyOrderUnit: body.qtyOrderUnit,
      note: body.note,
      createdBy: actorEmail,
    });
    await appendAudit(tx, {
      tenantId: ctx.tenantId,
      entity: "OrderSuggestion",
      entityId: sug.id,
      action: "CREATE",
      actorId,
      actorEmail,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
      after: {
        articleSku: article.sku,
        qty: body.qtyOrderUnit,
        reason: "MANUAL_SCAN",
      },
    });
    return sug;
  });

  return created(s);
});
