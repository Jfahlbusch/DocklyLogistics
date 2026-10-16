import { prisma } from "@/lib/db/client";

/**
 * Benachrichtigungen gelten mandantenweit, der Lesestatus je Nutzer (E-Mail):
 * Liest A eine Meldung, bleibt sie für B ungelesen.
 *
 * Altbestand: `Notification.readAt` stammt aus der Zeit, als der Lesestatus noch
 * mandantenweit war. Das Feld wird nicht mehr gesetzt. Meldungen, bei denen es
 * gesetzt ist, gelten weiterhin als für ALLE gelesen — sonst würden nach der
 * Umstellung alle bereits quittierten Meldungen für jeden wieder als neu auftauchen.
 * Für neue Meldungen zählt ausschließlich `NotificationRead`.
 */

/** Neueste zuerst; `id` macht die Reihenfolge bei gleichem Zeitstempel deterministisch. */
const NEWEST_FIRST = [{ createdAt: "desc" as const }, { id: "desc" as const }];

export const notificationRepo = {
  /**
   * Die neuesten Meldungen des Mandanten. `readAt` ist der Lesezeitpunkt des
   * anfragenden Nutzers (sonst der Altbestandswert), `null` = ungelesen.
   */
  async listRecent(tenantId: string, userEmail: string, limit = 20) {
    const rows = await prisma.notification.findMany({
      where: { tenantId },
      orderBy: NEWEST_FIRST,
      take: limit,
      include: { reads: { where: { userEmail }, select: { readAt: true }, take: 1 } },
    });
    return rows.map(({ reads, readAt, ...n }) => ({ ...n, readAt: reads[0]?.readAt ?? readAt ?? null }));
  },

  async unreadCount(tenantId: string, userEmail: string) {
    return prisma.notification.count({
      where: { tenantId, readAt: null, reads: { none: { userEmail } } },
    });
  },

  async create(data: {
    tenantId: string;
    type: string;
    title: string;
    body?: string | null;
    link?: string | null;
  }) {
    return prisma.notification.create({
      data: {
        tenantId: data.tenantId,
        type: data.type,
        title: data.title,
        body: data.body ?? null,
        link: data.link ?? null,
      },
    });
  },

  /**
   * Quittiert eine Meldung für den Nutzer. Idempotent (die erste Quittung bleibt
   * erhalten). Eine ID aus einem fremden Mandanten wird ignoriert — Rückgabe `false`.
   */
  async markRead(tenantId: string, userEmail: string, id: string): Promise<boolean> {
    const own = await prisma.notification.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!own) return false;
    // createMany + skipDuplicates statt upsert: bleibt bei parallelen Klicks ohne Unique-Fehler.
    await prisma.notificationRead.createMany({
      data: [{ notificationId: id, userEmail, tenantId }],
      skipDuplicates: true,
    });
    return true;
  },

  /** Quittiert alle offenen Meldungen des Mandanten für den Nutzer. Gibt die Anzahl neu quittierter zurück. */
  async markAllRead(tenantId: string, userEmail: string): Promise<number> {
    const open = await prisma.notification.findMany({
      where: { tenantId, readAt: null, reads: { none: { userEmail } } },
      select: { id: true },
    });
    if (open.length === 0) return 0;
    const res = await prisma.notificationRead.createMany({
      data: open.map(({ id }) => ({ notificationId: id, userEmail, tenantId })),
      skipDuplicates: true,
    });
    return res.count;
  },
};
