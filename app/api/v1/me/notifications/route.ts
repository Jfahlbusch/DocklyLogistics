import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok } from "@/lib/api/respond";
import { notificationRepo } from "@/lib/db/repos/notification";

/** GET /api/v1/me/notifications — recent tenant notifications + unread count. */
export const GET = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const [items, unread] = await Promise.all([
    notificationRepo.listRecent(ctx.tenantId, 20),
    notificationRepo.unreadCount(ctx.tenantId),
  ]);
  return ok({ items, unread });
});
