import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { articleRepo } from "@/lib/db/repos/article";
import { supplierRepo } from "@/lib/db/repos/supplier";
import { articleSupplierRepo } from "@/lib/db/repos/article-supplier";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, created, fail } from "@/lib/api/respond";
import { ArticleSupplierCreateSchema } from "@/lib/schemas/supplier";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = requireRoleFromHeaders(req.headers, "VIEWER");
  const { id } = await params;
  const article = await articleRepo.findById(ctx.tenantId, id);
  if (!article) return fail(404, "Article not found");
  const links = await articleSupplierRepo.listForArticle(ctx.tenantId, id);
  return ok(links);
});

export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = requireRoleFromHeaders(req.headers, "USER");
  const { id } = await params;
  const body = ArticleSupplierCreateSchema.parse(await req.json());

  const article = await articleRepo.findById(ctx.tenantId, id);
  if (!article) return fail(404, "Article not found");

  const supplier = await supplierRepo.findById(ctx.tenantId, body.supplierId);
  if (!supplier) return fail(404, "Supplier not found");

  const existing = await articleSupplierRepo.findLink(ctx.tenantId, id, body.supplierId);
  if (existing) return fail(409, "Link already exists");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const link = await prisma.$transaction(async (tx) => {
    const l = await articleSupplierRepo.create(tx, ctx.tenantId, id, body);
    await appendAudit(tx, {
      tenantId: ctx.tenantId, entity: "ArticleSupplier", entityId: l.id, action: "CREATE",
      actorId, actorEmail,
      after: { articleId: id, supplierId: body.supplierId, isPrimary: body.isPrimary },
    });
    return l;
  });

  return created(link);
});
