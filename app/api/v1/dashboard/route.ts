import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok } from "@/lib/api/respond";
import { getDashboardData } from "@/lib/services/dashboard";

/** GET /api/v1/dashboard — KPIs + Unterdeckungen + letzte Aktivität (tenant-scoped). */
export const GET = handler(async (req: NextRequest) => {
  const ctx = requireRoleFromHeaders(req.headers, "VIEWER");
  const data = await getDashboardData(ctx.tenantId);
  return ok(data);
});
