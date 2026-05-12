import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db/client";
import { appendAudit } from "./append";
import type { Prisma } from "@prisma/client";

const TENANT_ID = "test-audit-tenant";

async function clearTenant(tx: Prisma.TransactionClient | typeof prisma) {
  await tx.auditLog.deleteMany({ where: { tenantId: TENANT_ID } });
  await tx.user.deleteMany({ where: { tenantId: TENANT_ID } });
  await tx.tenant.deleteMany({ where: { id: TENANT_ID } });
}

beforeAll(async () => {
  await clearTenant(prisma);
  await prisma.tenant.create({
    data: { id: TENANT_ID, name: "test-audit" },
  });
});

afterAll(async () => {
  await clearTenant(prisma);
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.auditLog.deleteMany({ where: { tenantId: TENANT_ID } });
});

describe("appendAudit", () => {
  it("creates an audit entry with action CREATE", async () => {
    await prisma.$transaction(async (tx) => {
      await appendAudit(tx, {
        tenantId: TENANT_ID,
        entity: "Article",
        entityId: "art-1",
        action: "CREATE",
        actorId: "user-1",
        actorEmail: "test@example.com",
        before: null,
        after: { name: "Mehl", sku: "MEHL-1" },
      });
    });

    const entries = await prisma.auditLog.findMany({ where: { tenantId: TENANT_ID } });
    expect(entries).toHaveLength(1);
    expect(entries[0].entity).toBe("Article");
    expect(entries[0].entityId).toBe("art-1");
    expect(entries[0].action).toBe("CREATE");
    expect(entries[0].actorEmail).toBe("test@example.com");
    expect(entries[0].after).toMatchObject({ name: "Mehl", sku: "MEHL-1" });
  });

  it("supports optional ip and userAgent", async () => {
    await prisma.$transaction(async (tx) => {
      await appendAudit(tx, {
        tenantId: TENANT_ID,
        entity: "Supplier",
        entityId: "sup-1",
        action: "UPDATE",
        actorId: "user-1",
        actorEmail: "test@example.com",
        ip: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        before: { name: "Old" },
        after: { name: "New" },
      });
    });

    const entry = await prisma.auditLog.findFirst({ where: { tenantId: TENANT_ID } });
    expect(entry?.ip).toBe("192.168.1.1");
    expect(entry?.userAgent).toBe("Mozilla/5.0");
  });

  it("rolls back when surrounding transaction throws", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await appendAudit(tx, {
          tenantId: TENANT_ID,
          entity: "Article",
          entityId: "art-rollback",
          action: "DELETE",
          actorId: "user-1",
          actorEmail: "test@example.com",
        });
        throw new Error("deliberate");
      }),
    ).rejects.toThrow("deliberate");

    const count = await prisma.auditLog.count({ where: { tenantId: TENANT_ID } });
    expect(count).toBe(0);
  });

  it("can be called multiple times in a single transaction", async () => {
    await prisma.$transaction(async (tx) => {
      await appendAudit(tx, {
        tenantId: TENANT_ID,
        entity: "Article",
        entityId: "art-A",
        action: "CREATE",
        actorId: "user-1",
        actorEmail: "test@example.com",
      });
      await appendAudit(tx, {
        tenantId: TENANT_ID,
        entity: "Article",
        entityId: "art-A",
        action: "UPDATE",
        actorId: "user-1",
        actorEmail: "test@example.com",
        before: { name: "old" },
        after: { name: "new" },
      });
    });

    const entries = await prisma.auditLog.findMany({
      where: { tenantId: TENANT_ID },
      orderBy: { createdAt: "asc" },
    });
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.action)).toEqual(["CREATE", "UPDATE"]);
  });
});
