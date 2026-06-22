import { prisma } from "@/lib/db/client";

export const notificationRepo = {
  async listRecent(tenantId: string, limit = 20) {
    return prisma.notification.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  async unreadCount(tenantId: string) {
    return prisma.notification.count({ where: { tenantId, readAt: null } });
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

  /** Mark one unread notification read (tenant-scoped). Returns the batch count. */
  async markRead(tenantId: string, id: string) {
    return prisma.notification.updateMany({
      where: { id, tenantId, readAt: null },
      data: { readAt: new Date() },
    });
  },

  async markAllRead(tenantId: string) {
    return prisma.notification.updateMany({
      where: { tenantId, readAt: null },
      data: { readAt: new Date() },
    });
  },
};
