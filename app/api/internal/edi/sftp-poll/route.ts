import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { ok, fail } from "@/lib/api/respond";
import { sftpService } from "@/lib/services/sftp-service";

/**
 * Internal cron: poll every tenant's SFTP outbox and relay new files to the
 * trading partners. Protected by X-Internal-Cron-Secret (env CRON_SECRET).
 */
export const POST = handler(async (req: NextRequest) => {
  const expected = process.env.CRON_SECRET;
  if (!expected) return fail(503, "Cron not configured", "Server has no CRON_SECRET");
  if (req.headers.get("x-internal-cron-secret") !== expected) return fail(401, "Unauthorized");
  return ok(await sftpService.pollAll());
});
