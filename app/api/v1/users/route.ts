import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok } from "@/lib/api/respond";
import { userRepo } from "@/lib/db/repos/user";

/** GET /api/v1/users — users of the caller's tenant (MANAGER+). */
export const GET = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  return ok(await userRepo.listForTenant(ctx.tenantId));
});
