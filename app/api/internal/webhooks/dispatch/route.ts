import type { NextRequest } from "next/server";
import { runWebhookWorker } from "@/lib/services/webhook-worker";
import { handler } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { requireCronSecret } from "@/lib/api/cron-auth";

/**
 * Internal endpoint to run the webhook outbox worker. Protected by a shared secret
 * in `X-Internal-Cron-Secret` header (env CRON_SECRET).
 * Called by Vercel Cron / external scheduler every 30s.
 */
export const POST = handler(async (req: NextRequest) => {
  const denied = requireCronSecret(req.headers);
  if (denied) return denied;

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 10);
  const result = await runWebhookWorker(Math.max(1, Math.min(100, limit)));
  return ok(result);
});
