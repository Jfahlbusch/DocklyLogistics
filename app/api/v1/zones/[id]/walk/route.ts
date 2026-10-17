import type { NextRequest } from "next/server";
import { zoneRepo } from "@/lib/db/repos/zone";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const { id } = await params;
  const walk = await zoneRepo.walk(ctx.tenantId, id);
  if (!walk) return fail(404, "Not Found");
  return ok(walk);
});
