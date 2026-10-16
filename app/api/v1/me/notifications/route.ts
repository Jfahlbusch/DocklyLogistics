import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireUserFromHeaders } from "@/lib/api/guard";
import { ok } from "@/lib/api/respond";
import { notificationRepo } from "@/lib/db/repos/notification";
import { NotificationListSchema, toNotificationDto } from "@/lib/schemas/notification";

/**
 * GET /api/v1/me/notifications — die 20 neuesten Meldungen des Mandanten mit dem
 * Lesestatus des anfragenden Nutzers + dessen Ungelesen-Zähler.
 */
export const GET = handler(async (req: NextRequest) => {
  const ctx = await requireUserFromHeaders(req.headers, "VIEWER");
  const [items, unread] = await Promise.all([
    notificationRepo.listRecent(ctx.tenantId, ctx.userEmail, 20),
    notificationRepo.unreadCount(ctx.tenantId, ctx.userEmail),
  ]);
  // Antwort über dasselbe Schema, das die OpenAPI-Doku verwendet.
  return ok(NotificationListSchema.parse({ items: items.map(toNotificationDto), unread }));
});
