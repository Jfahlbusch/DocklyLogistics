import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireUserFromHeaders } from "@/lib/api/guard";
import { ok } from "@/lib/api/respond";
import { notificationRepo } from "@/lib/db/repos/notification";
import { NotificationReadSchema } from "@/lib/schemas/notification";

/**
 * POST /api/v1/me/notifications/read — Meldungen für den aktuellen Nutzer als
 * gelesen markieren. Body `{ id }` quittiert eine, ein leerer Body alle. Mandant
 * und Nutzer stammen ausschließlich aus der Authentifizierung.
 */
export const POST = handler(async (req: NextRequest) => {
  const ctx = await requireUserFromHeaders(req.headers, "VIEWER");
  const body = NotificationReadSchema.parse(await req.json().catch(() => ({})));
  if (body.id) {
    await notificationRepo.markRead(ctx.tenantId, ctx.userEmail, body.id);
  } else {
    await notificationRepo.markAllRead(ctx.tenantId, ctx.userEmail);
  }
  return ok({ ok: true });
});
