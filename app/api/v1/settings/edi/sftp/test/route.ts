import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";
import { sftpService } from "@/lib/services/sftp-service";

/** POST /api/v1/settings/edi/sftp/test — connect + list both directories. */
export const POST = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const r = await sftpService.testConnection(ctx.tenantId);
  if (!r.ok) return fail(422, "Verbindung fehlgeschlagen", r.message);
  return ok({ message: r.message });
});
