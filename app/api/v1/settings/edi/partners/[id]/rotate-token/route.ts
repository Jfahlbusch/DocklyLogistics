import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";
import { ediPartnerMailboxRepo } from "@/lib/db/repos/edi-partner-mailbox";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/v1/settings/edi/partners/{id}/rotate-token — old token invalid immediately. */
export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;
  const row = await ediPartnerMailboxRepo.rotateToken(ctx.tenantId, id);
  if (!row) return fail(404, "Nicht gefunden", "Partner-Postfach existiert nicht");
  return ok({ ...row, inboundPath: `/api/edi/inbound/${row.token}` });
});
