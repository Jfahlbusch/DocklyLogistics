import type { NextRequest } from "next/server";
import { stockRepo } from "@/lib/db/repos/stock";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok } from "@/lib/api/respond";
import { StockListQuerySchema } from "@/lib/schemas/stock";

export const GET = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const query = StockListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const { items, total } = await stockRepo.listBalances({ tenantId: ctx.tenantId, ...query });
  return ok(items, { page: query.page, pageSize: query.pageSize, total });
});
