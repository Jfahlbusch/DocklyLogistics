import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import { notificationRepo } from "./notification";

const T = "test-notif";

describe("notificationRepo", () => {
  beforeAll(async () => {
    await prisma.notification.deleteMany({ where: { tenantId: T } });
    await prisma.tenant.upsert({ where: { id: T }, update: {}, create: { id: T, name: T } });
  });
  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { tenantId: T } });
    await prisma.tenant.deleteMany({ where: { id: T } });
  });

  it("creates, lists newest-first, and counts unread", async () => {
    await notificationRepo.create({ tenantId: T, type: "webhook.failed", title: "A" });
    await notificationRepo.create({ tenantId: T, type: "webhook.failed", title: "B" });
    expect(await notificationRepo.unreadCount(T)).toBe(2);
    const list = await notificationRepo.listRecent(T, 10);
    expect(list.length).toBe(2);
    expect(list[0].title).toBe("B");
  });

  it("marks one read, tenant-scoped", async () => {
    const n = await notificationRepo.create({ tenantId: T, type: "x", title: "C" });
    expect((await notificationRepo.markRead("other-tenant", n.id)).count).toBe(0);
    expect((await notificationRepo.markRead(T, n.id)).count).toBe(1);
    const fresh = await prisma.notification.findUnique({ where: { id: n.id } });
    expect(fresh?.readAt).not.toBeNull();
  });

  it("marks all read", async () => {
    expect((await notificationRepo.markAllRead(T)).count).toBeGreaterThanOrEqual(1);
    expect(await notificationRepo.unreadCount(T)).toBe(0);
  });
});
