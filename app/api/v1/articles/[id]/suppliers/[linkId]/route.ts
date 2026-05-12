import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { articleRepo } from "@/lib/db/repos/article";
import { articleSupplierRepo } from "@/lib/db/repos/article-supplier";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { noContent, fail } from "@/lib/api/respond";

type Ctx = { params: Promise<{ id: string; linkId: string }> };

export const DELETE = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = requireRoleFromHeaders(req.headers, "USER");
  const { id, linkId } = await params;

  const article = await articleRepo.findById(ctx.tenantId, id);
  if (!article) return fail(404, "Article not found");

  const link = await articleSupplierRepo.findById(linkId);
  if (!link || link.articleId !== id) return fail(404, "Link not found");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  await prisma.$transaction(async (tx) => {
    await articleSupplierRepo.remove(tx, linkId);
    await appendAudit(tx, {
      tenantId: ctx.tenantId, entity: "ArticleSupplier", entityId: linkId, action: "DELETE",
      actorId, actorEmail,
      before: { articleId: link.articleId, supplierId: link.supplierId },
    });
  });

  return noContent();
});
