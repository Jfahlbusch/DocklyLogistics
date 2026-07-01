import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok } from "@/lib/api/respond";
import { tenantEdiSettingsRepo } from "@/lib/db/repos/tenant-edi-settings";
import { EdiSettingsUpdateSchema } from "@/lib/schemas/edi";

function view(s: { inboundToken: string; inboundActive: boolean; autoConfirm: boolean }) {
  return {
    inboundToken: s.inboundToken,
    inboundActive: s.inboundActive,
    autoConfirm: s.autoConfirm,
    inboundPath: `/api/edi/inbound/${s.inboundToken}`,
  };
}

/** GET /api/v1/settings/edi — mailbox token + processing flags (creates on first call). */
export const GET = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const s = await tenantEdiSettingsRepo.ensure(ctx.tenantId);
  return ok(view(s));
});

/** PUT /api/v1/settings/edi — toggle inboundActive / autoConfirm. */
export const PUT = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const body = EdiSettingsUpdateSchema.parse(await req.json());
  await tenantEdiSettingsRepo.ensure(ctx.tenantId);
  const s = await tenantEdiSettingsRepo.update(ctx.tenantId, body);
  return ok(view(s));
});
