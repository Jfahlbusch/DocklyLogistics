import type { NextRequest } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";
import { verifyChain } from "@/lib/audit/verify";

const QuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD"),
});

export const GET = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const params = QuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  if (!params.success) return fail(422, "Invalid date", params.error.message);
  const result = await verifyChain(ctx.tenantId, params.data.date);
  return ok(result);
});
