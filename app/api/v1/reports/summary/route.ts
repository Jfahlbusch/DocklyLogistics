import type { NextRequest } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";
import { summary, bySupplier } from "@/lib/services/reports";

const Q = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const GET = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const parsed = Q.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return fail(422, "Invalid query", parsed.error.message);

  const range = {
    from: parsed.data.from ? new Date(parsed.data.from) : undefined,
    to: parsed.data.to ? new Date(parsed.data.to) : undefined,
  };
  const [s, bs] = await Promise.all([
    summary(ctx.tenantId, range),
    bySupplier(ctx.tenantId, range),
  ]);
  return ok({ summary: s, bySupplier: bs });
});
