import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok } from "@/lib/api/respond";
import { notificationRepo } from "@/lib/db/repos/notification";

/**
 * POST /api/v1/me/notifications/read — mark notifications read.
 * Body `{ id }` marks one; empty body marks all.
 */
export const POST = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (body.id) {
    await notificationRepo.markRead(ctx.tenantId, body.id);
  } else {
    await notificationRepo.markAllRead(ctx.tenantId);
  }
  return ok({ ok: true });
});
