import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db/client";
import { appendAudit } from "./append";
import { verifyChain } from "./verify";
import { sealDay } from "./seal";

const TENANT_ID = "test-chain-tenant";

/**
 * Delete audit-log rows using a transaction-local replica role to bypass
 * the append-only trigger without touching the table state (which would
 * race with other parallel test files that also DISABLE/ENABLE the trigger).
 */
async function purgeAuditLog() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = 'replica';");
    await tx.auditLog.deleteMany({ where: { tenantId: TENANT_ID } });
  });
}

async function cleanup() {
  await purgeAuditLog();
  await prisma.auditSeal.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.user.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
}

beforeAll(async () => {
  await cleanup();
  await prisma.tenant.create({ data: { id: TENANT_ID, name: "test-chain" } });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await purgeAuditLog();
  await prisma.auditSeal.deleteMany({ where: { tenantId: TENANT_ID } });
});

async function append(action: string, entityId: string) {
  await prisma.$transaction(async (tx) => {
    await appendAudit(tx, {
      tenantId: TENANT_ID,
      entity: "Test",
      entityId,
      action: action as never,
      actorId: "u",
      actorEmail: "u@x",
    });
  });
}

describe("appendAudit hash chain", () => {
  it("first entry has GENESIS prevHash", async () => {
    await append("CREATE", "e1");
    const r = await prisma.auditLog.findFirst({
      where: { tenantId: TENANT_ID },
    });
    expect(r!.prevHash).toBe("0".repeat(64));
    expect(r!.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("subsequent entries chain via prevHash", async () => {
    await append("CREATE", "e1");
    await append("UPDATE", "e1");
    const rows = await prisma.auditLog.findMany({
      where: { tenantId: TENANT_ID },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    expect(rows.length).toBe(2);
    expect(rows[1].prevHash).toBe(rows[0].hash);
  });
});

describe("verifyChain", () => {
  it("returns ok when chain intact", async () => {
    await append("CREATE", "e1");
    await append("UPDATE", "e1");
    const today = new Date().toISOString().slice(0, 10);
    const r = await verifyChain(TENANT_ID, today);
    expect(r.ok).toBe(true);
    expect(r.entryCount).toBe(2);
    expect(r.firstMismatchAt).toBeNull();
  });

  it("returns ok=true and entryCount=0 when no entries", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const r = await verifyChain(TENANT_ID, today);
    expect(r.ok).toBe(true);
    expect(r.entryCount).toBe(0);
  });
});

describe("sealDay + verify", () => {
  it("creates AuditSeal and verify matches", async () => {
    await append("CREATE", "e1");
    const today = new Date().toISOString().slice(0, 10);
    const seal = await sealDay(TENANT_ID, today);
    expect(seal?.newSeal).toBe(true);
    expect(seal?.entryCount).toBe(1);
    expect(seal?.rootHash).toMatch(/^[0-9a-f]{64}$/);

    const v = await verifyChain(TENANT_ID, today);
    expect(v.ok).toBe(true);
    expect(v.rootHash).toBe(seal!.rootHash);
    expect(v.storedSealRoot).toBe(seal!.rootHash);
  });

  it("sealDay is idempotent (same hash on re-run)", async () => {
    await append("CREATE", "e1");
    const today = new Date().toISOString().slice(0, 10);
    const a = await sealDay(TENANT_ID, today);
    const b = await sealDay(TENANT_ID, today);
    expect(a?.newSeal).toBe(true);
    expect(b?.newSeal).toBe(false);
    expect(b?.rootHash).toBe(a?.rootHash);
  });
});
