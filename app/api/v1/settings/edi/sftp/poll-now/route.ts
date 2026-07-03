import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";
import { sftpService } from "@/lib/services/sftp-service";

/** POST /api/v1/settings/edi/sftp/poll-now — dispatch the outbox on demand. */
export const POST = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  try {
    return ok(await sftpService.pollOutbox(ctx.tenantId));
  } catch (e) {
    return fail(422, "Abruf fehlgeschlagen", e instanceof Error ? e.message : String(e));
  }
});
