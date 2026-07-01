import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";
import { ediMessageRepo } from "@/lib/db/repos/edi-message";
import { ediService } from "@/lib/services/edi-service";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/v1/edi/messages/{id}/reprocess — re-run inbound processing. */
export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;
  const msg = await ediMessageRepo.findInTenant(ctx.tenantId, id);
  if (!msg) return fail(404, "Nicht gefunden", "EDI-Nachricht existiert nicht in diesem Tenant");
  if (msg.direction !== "IN") {
    return fail(409, "Nicht möglich", "Nur eingehende Nachrichten können erneut verarbeitet werden");
  }
  const result = await ediService.reprocess(ctx.tenantId, id);
  return ok(result);
});
