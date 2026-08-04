import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { requireCronSecret } from "@/lib/api/cron-auth";
import { sftpService } from "@/lib/services/sftp-service";

/**
 * Internal cron: poll every tenant's SFTP outbox and relay new files to the
 * trading partners. Protected by X-Internal-Cron-Secret (env CRON_SECRET).
 */
export const POST = handler(async (req: NextRequest) => {
  const denied = requireCronSecret(req.headers);
  if (denied) return denied;
  return ok(await sftpService.pollAll());
});
