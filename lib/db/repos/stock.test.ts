import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db/client";
import { stockRepo, InsufficientStockError } from "./stock";

const TENANT_ID = "test-stock-tenant";
let articleId = "";
let locA = "";
let locB = "";

async function deleteStockMovementsRaw() {
  // The append-only trigger on StockMovement blocks DELETE in normal queries.
  // Tests need to wipe rows between cases, so we disable the trigger transiently.
  await prisma.$executeRawUnsafe(`ALTER TABLE "StockMovement" DISABLE TRIGGER stockmovement_no_update`);
  try {
    await prisma.stockMovement.deleteMany({ where: { tenantId: TENANT_ID } });
  } finally {
    await prisma.$executeRawUnsafe(`ALTER TABLE "StockMovement" ENABLE TRIGGER stockmovement_no_update`);
  }
}

async function cleanup() {
  await deleteStockMovementsRaw();
  await prisma.stockBalance.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.article.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.storageLocation.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
}

beforeAll(async () => {
  await cleanup();
  await prisma.tenant.create({ data: { id: TENANT_ID, name: "test-stock" } });
  const a = await prisma.article.create({
    data: {
      tenantId: TENANT_ID,
      sku: "TEST-1",
      name: "Test",
      baseUnit: "KG",
      orderUnit: "SACK",
      packFactor: 25,
      barcodeSource: "SKU",
      minStock: 5,
    },
  });
  articleId = a.id;
  const la = await prisma.storageLocation.create({ data: { tenantId: TENANT_ID, code: "L-A", name: "A" } });
  const lb = await prisma.storageLocation.create({ data: { tenantId: TENANT_ID, code: "L-B", name: "B" } });
  locA = la.id;
  locB = lb.id;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await deleteStockMovementsRaw();
  await prisma.stockBalance.deleteMany({ where: { tenantId: TENANT_ID } });
});

describe("stockRepo.applyDelta", () => {
  it("creates a new balance and movement on first delta", async () => {
    await prisma.$transaction(async (tx) => {
      const r = await stockRepo.applyDelta(tx, {
        tenantId: TENANT_ID,
        articleId,
        locationId: locA,
        delta: 10,
        reason: "RECEIPT",
        createdBy: "test",
      });
      expect(r.balance.quantity).toBe(10);
      expect(r.movement.delta).toBe(10);
    });
  });

  it("accumulates on subsequent deltas", async () => {
    await prisma.$transaction(async (tx) => {
      await stockRepo.applyDelta(tx, {
        tenantId: TENANT_ID,
        articleId,
        locationId: locA,
        delta: 10,
        reason: "RECEIPT",
        createdBy: "t",
      });
    });
    await prisma.$transaction(async (tx) => {
      const r = await stockRepo.applyDelta(tx, {
        tenantId: TENANT_ID,
        articleId,
        locationId: locA,
        delta: -3,
        reason: "ISSUE",
        createdBy: "t",
      });
      expect(r.balance.quantity).toBe(7);
    });
  });

  it("rejects deltas that would push the balance negative", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await stockRepo.applyDelta(tx, {
          tenantId: TENANT_ID,
          articleId,
          locationId: locA,
          delta: -1,
          reason: "ISSUE",
          createdBy: "t",
        });
      }),
    ).rejects.toThrow(InsufficientStockError);
  });

  it("totalsByArticle sums across locations", async () => {
    await prisma.$transaction(async (tx) => {
      await stockRepo.applyDelta(tx, {
        tenantId: TENANT_ID,
        articleId,
        locationId: locA,
        delta: 5,
        reason: "RECEIPT",
        createdBy: "t",
      });
      await stockRepo.applyDelta(tx, {
        tenantId: TENANT_ID,
        articleId,
        locationId: locB,
        delta: 7,
        reason: "RECEIPT",
        createdBy: "t",
      });
    });
    const totals = await stockRepo.totalsByArticle(TENANT_ID, [articleId]);
    expect(totals.get(articleId)).toBe(12);
  });

  it("StockMovement is append-only (DB trigger)", async () => {
    let mvtId = "";
    await prisma.$transaction(async (tx) => {
      const r = await stockRepo.applyDelta(tx, {
        tenantId: TENANT_ID,
        articleId,
        locationId: locA,
        delta: 1,
        reason: "RECEIPT",
        createdBy: "t",
      });
      mvtId = r.movement.id;
    });
    await expect(
      prisma.stockMovement.update({ where: { id: mvtId }, data: { reason: "HAX" } }),
    ).rejects.toThrow(/Append-only/);
  });
});
