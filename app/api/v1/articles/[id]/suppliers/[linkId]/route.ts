import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { articleRepo } from "@/lib/db/repos/article";
import { articleSupplierRepo } from "@/lib/db/repos/article-supplier";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { noContent, ok, fail } from "@/lib/api/respond";
import { ArticleSupplierUpdateSchema } from "@/lib/schemas/supplier";

type Ctx = { params: Promise<{ id: string; linkId: string }> };

export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = requireRoleFromHeaders(req.headers, "USER");
  const { id, linkId } = await params;
  const body = ArticleSupplierUpdateSchema.parse(await req.json());

  const article = await articleRepo.findById(ctx.tenantId, id);
  if (!article) return fail(404, "Article not found");

  const link = await articleSupplierRepo.findById(ctx.tenantId, linkId);
  if (!link || link.articleId !== id) return fail(404, "Link not found");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const updated = await prisma.$transaction(async (tx) => {
    const u = await articleSupplierRepo.update(tx, ctx.tenantId, id, linkId, {
      purchasePrice: body.purchasePrice,
      currency: body.currency,
      isPrimary: body.isPrimary,
      leadTimeDays: body.leadTimeDays,
      minOrderQty: body.minOrderQty,
      supplierSku: body.supplierSku,
    });
    await appendAudit(tx, {
      tenantId: ctx.tenantId, entity: "ArticleSupplier", entityId: linkId, action: "UPDATE",
      actorId, actorEmail,
      before: { isPrimary: link.isPrimary, price: Number(link.purchasePrice) },
      after: { isPrimary: u.isPrimary, price: Number(u.purchasePrice) },
    });
    return u;
  });

  return ok(updated);
});

export const DELETE = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = requireRoleFromHeaders(req.headers, "USER");
  const { id, linkId } = await params;

  const article = await articleRepo.findById(ctx.tenantId, id);
  if (!article) return fail(404, "Article not found");

  const link = await articleSupplierRepo.findById(ctx.tenantId, linkId);
  if (!link || link.articleId !== id) return fail(404, "Link not found");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  await prisma.$transaction(async (tx) => {
    await articleSupplierRepo.remove(tx, ctx.tenantId, linkId);
    await appendAudit(tx, {
      tenantId: ctx.tenantId, entity: "ArticleSupplier", entityId: linkId, action: "DELETE",
      actorId, actorEmail,
      before: { articleId: link.articleId, supplierId: link.supplierId },
    });
  });

  return noContent();
});
