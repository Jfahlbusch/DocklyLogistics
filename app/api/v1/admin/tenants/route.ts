import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok } from "@/lib/api/respond";
import { adminFeaturesRepo } from "@/lib/db/repos/admin-features";

/**
 * GET /api/v1/admin/tenants — operator overview (GLOBAL_ADMIN only).
 * Cross-tenant by design: this is the one sanctioned admin surface.
 */
export const GET = handler(async (req: NextRequest) => {
  await requireRoleFromHeaders(req.headers, "GLOBAL_ADMIN");
  const tenants = await adminFeaturesRepo.listTenants();
  return ok(tenants);
});
