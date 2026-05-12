import type { NextRequest } from "next/server";
import { stockRepo } from "@/lib/db/repos/stock";
import { articleRepo } from "@/lib/db/repos/article";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";
import { StockHistoryQuerySchema } from "@/lib/schemas/stock";

type Ctx = { params: Promise<{ articleId: string }> };

export const GET = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = requireRoleFromHeaders(req.headers, "VIEWER");
  const { articleId } = await params;
  const article = await articleRepo.findById(ctx.tenantId, articleId);
  if (!article) return fail(404, "Article not found");
  const query = StockHistoryQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const { items, total } = await stockRepo.listMovementsForArticle({
    tenantId: ctx.tenantId,
    articleId,
    ...query,
  });
  return ok(items, { page: query.page, pageSize: query.pageSize, total });
});
