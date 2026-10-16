import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/db/client";
import { purgeAppendOnly } from "../helpers/purge-append-only";

/**
 * purgeAppendOnly räumt die Append-only-Tabellen (OrderEvent, AuditLog,
 * StockMovement) mandantenscharf auf — über `SET LOCAL session_replication_role
 * = replica` nur in der eigenen Transaktion. Die Trigger bleiben global aktiv,
 * parallele Testdateien sehen davon nichts.
 */

const SUFFIX = crypto.randomBytes(4).toString("hex");
const MINE = `test-purge-mine-${SUFFIX}`;
const OTHER = `test-purge-other-${SUFFIX}`;

async function seedTenant(id: string) {
  await prisma.tenant.create({ data: { id, name: id } });
  const supplier = await prisma.supplier.create({
    data: { tenantId: id, name: `Lieferant ${id}`, channel: "EMAIL", channelConfig: {}, active: true },
  });
  const article = await prisma.article.create({
    data: {
      tenantId: id, sku: `PURGE-${id}`, name: "Purge", baseUnit: "KG",
      orderUnit: "SACK", packFactor: 25, barcodeSource: "SKU",
    },
  });
  const location = await prisma.storageLocation.create({ data: { tenantId: id, code: "P-1", name: "P" } });
  const order = await prisma.order.create({
    data: { tenantId: id, orderNo: `PURGE-${id}`, supplierId: supplier.id, status: "DRAFT", total: 0, createdBy: "test" },
  });
  const event = await prisma.orderEvent.create({
    data: { orderId: order.id, type: "CREATED", actorId: "t", actorEmail: "t@example.com", payload: {} },
  });
  const audit = await prisma.auditLog.create({
    data: { tenantId: id, entity: "Test", entityId: "x", action: "CREATE", actorId: "t", actorEmail: "t@example.com" },
  });
  const movement = await prisma.stockMovement.create({
    data: { tenantId: id, articleId: article.id, locationId: location.id, delta: 1, reason: "RECEIPT", createdBy: "t" },
  });
  return { event, audit, movement };
}

async function removeTenant(id: string) {
  await purgeAppendOnly(prisma, { tenantIds: [id] });
  await prisma.order.deleteMany({ where: { tenantId: id } });
  await prisma.stockBalance.deleteMany({ where: { tenantId: id } });
  await prisma.supplier.deleteMany({ where: { tenantId: id } });
  await prisma.article.deleteMany({ where: { tenantId: id } });
  await prisma.storageLocation.deleteMany({ where: { tenantId: id } });
  await prisma.tenant.deleteMany({ where: { id } });
}

let other: Awaited<ReturnType<typeof seedTenant>>;

beforeAll(async () => {
  await removeTenant(MINE);
  await removeTenant(OTHER);
  await seedTenant(MINE);
  other = await seedTenant(OTHER);
});

afterAll(async () => {
  await removeTenant(MINE);
  await removeTenant(OTHER);
  await prisma.$disconnect();
});

describe("purgeAppendOnly", () => {
  it("removes all append-only rows of the given tenants and leaves other tenants alone", async () => {
    await purgeAppendOnly(prisma, { tenantIds: [MINE] });

    expect(await prisma.orderEvent.count({ where: { order: { tenantId: MINE } } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { tenantId: MINE } })).toBe(0);
    expect(await prisma.stockMovement.count({ where: { tenantId: MINE } })).toBe(0);

    expect(await prisma.orderEvent.count({ where: { order: { tenantId: OTHER } } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { tenantId: OTHER } })).toBe(1);
    expect(await prisma.stockMovement.count({ where: { tenantId: OTHER } })).toBe(1);
  });

  it("is a no-op for an empty tenant list", async () => {
    await purgeAppendOnly(prisma, { tenantIds: [] });
    expect(await prisma.auditLog.count({ where: { tenantId: OTHER } })).toBe(1);
  });

  it("keeps the triggers active for every other connection afterwards", async () => {
    await purgeAppendOnly(prisma, { tenantIds: [MINE] });

    await expect(
      prisma.orderEvent.update({ where: { id: other.event.id }, data: { type: "HAX" } }),
    ).rejects.toThrow(/Append-only/);
    await expect(prisma.auditLog.deleteMany({ where: { id: other.audit.id } })).rejects.toThrow(/Append-only/);
    await expect(
      prisma.stockMovement.update({ where: { id: other.movement.id }, data: { reason: "HAX" } }),
    ).rejects.toThrow(/Append-only/);
  });
});
