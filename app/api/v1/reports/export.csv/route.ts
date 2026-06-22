import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { fail } from "@/lib/api/respond";
import { orderRows, toCsv } from "@/lib/services/reports";

const Q = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const GET = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "USER");
  const parsed = Q.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return fail(422, "Invalid query", parsed.error.message);
  const range = {
    from: parsed.data.from ? new Date(parsed.data.from) : undefined,
    to: parsed.data.to ? new Date(parsed.data.to) : undefined,
  };
  const rows = await orderRows(ctx.tenantId, range);
  const csv = toCsv(rows);
  const filename = `orders-${ctx.tenantId}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
