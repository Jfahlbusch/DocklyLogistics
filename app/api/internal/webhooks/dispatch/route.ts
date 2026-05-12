import type { NextRequest } from "next/server";
import { runWebhookWorker } from "@/lib/services/webhook-worker";
import { handler } from "@/lib/api/handler";
import { ok, fail } from "@/lib/api/respond";

/**
 * Internal endpoint to run the webhook outbox worker. Protected by a shared secret
 * in `X-Internal-Cron-Secret` header (env CRON_SECRET).
 * Called by Vercel Cron / external scheduler every 30s.
 */
export const POST = handler(async (req: NextRequest) => {
  const expected = process.env.CRON_SECRET;
  if (!expected) return fail(503, "Cron not configured", "Server has no CRON_SECRET");
  const got = req.headers.get("x-internal-cron-secret");
  if (got !== expected) return fail(401, "Unauthorized");

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 10);
  const result = await runWebhookWorker(Math.max(1, Math.min(100, limit)));
  return ok(result);
});
