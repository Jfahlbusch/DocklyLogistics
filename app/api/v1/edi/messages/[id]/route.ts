import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";
import { ediMessageRepo } from "@/lib/db/repos/edi-message";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/v1/edi/messages/{id} — full message incl. raw EDIFACT payload. */
export const GET = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "USER");
  const { id } = await params;
  const msg = await ediMessageRepo.findInTenant(ctx.tenantId, id);
  if (!msg) return fail(404, "Nicht gefunden", "EDI-Nachricht existiert nicht in diesem Tenant");
  return ok(msg);
});
