import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok } from "@/lib/api/respond";
import { tenantEdiSettingsRepo } from "@/lib/db/repos/tenant-edi-settings";

/** POST /api/v1/settings/edi/rotate-token — new mailbox address; old token stops working immediately. */
export const POST = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const s = await tenantEdiSettingsRepo.rotateToken(ctx.tenantId);
  return ok({
    inboundToken: s.inboundToken,
    inboundActive: s.inboundActive,
    autoConfirm: s.autoConfirm,
    inboundPath: `/api/edi/inbound/${s.inboundToken}`,
  });
});
