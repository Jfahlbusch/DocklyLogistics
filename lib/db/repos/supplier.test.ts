import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db/client";
import { supplierRepo } from "./supplier";
import { articleSupplierRepo } from "./article-supplier";

const TENANT_ID = "test-supplier-tenant";

async function cleanup() {
  await prisma.articleSupplier.deleteMany({});
  await prisma.supplier.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.article.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
}

beforeAll(async () => {
  await cleanup();
  await prisma.tenant.create({ data: { id: TENANT_ID, name: "test-supplier" } });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.articleSupplier.deleteMany({});
  await prisma.supplier.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.article.deleteMany({ where: { tenantId: TENANT_ID } });
});

describe("supplierRepo", () => {
  it("creates a supplier with channel config", async () => {
    await prisma.$transaction(async (tx) => {
      await supplierRepo.create(tx, TENANT_ID, {
        name: "Test Lieferant", channel: "EMAIL",
        channelConfig: { to: "test@example.com" }, active: true,
      });
    });
    const found = await supplierRepo.findByName(TENANT_ID, "Test Lieferant");
    expect(found?.channel).toBe("EMAIL");
  });

  it("filters by channel", async () => {
    await prisma.$transaction(async (tx) => {
      await supplierRepo.create(tx, TENANT_ID, { name: "A", channel: "EMAIL", channelConfig: {}, active: true });
      await supplierRepo.create(tx, TENANT_ID, { name: "B", channel: "API", channelConfig: {}, active: true });
    });
    const result = await supplierRepo.list({ tenantId: TENANT_ID, channel: "API", page: 1, pageSize: 25 });
    expect(result.items.length).toBe(1);
    expect(result.items[0].name).toBe("B");
  });
});

describe("articleSupplierRepo isPrimary enforcement", () => {
  it("clears previous primary when new link is created with isPrimary=true", async () => {
    let articleId = "";
    let supplierAId = "";
    let supplierBId = "";

    await prisma.$transaction(async (tx) => {
      const a = await tx.article.create({
        data: {
          tenantId: TENANT_ID, sku: "ART-1", name: "Test Artikel",
          baseUnit: "KG", orderUnit: "SACK", packFactor: 25, barcodeSource: "SKU", minStock: 0,
        },
      });
      articleId = a.id;

      const sa = await supplierRepo.create(tx, TENANT_ID, { name: "Sup A", channel: "EMAIL", channelConfig: {}, active: true });
      supplierAId = sa.id;
      const sb = await supplierRepo.create(tx, TENANT_ID, { name: "Sup B", channel: "EMAIL", channelConfig: {}, active: true });
      supplierBId = sb.id;
    });

    await prisma.$transaction(async (tx) => {
      await articleSupplierRepo.create(tx, articleId, {
        supplierId: supplierAId, purchasePrice: 10, currency: "EUR",
        isPrimary: true, leadTimeDays: 3, minOrderQty: 1,
      });
    });

    // Now set B as primary — A should be flipped to non-primary
    await prisma.$transaction(async (tx) => {
      await articleSupplierRepo.create(tx, articleId, {
        supplierId: supplierBId, purchasePrice: 11, currency: "EUR",
        isPrimary: true, leadTimeDays: 3, minOrderQty: 1,
      });
    });

    const links = await articleSupplierRepo.listForArticle(articleId);
    const primaryCount = links.filter((l) => l.isPrimary).length;
    expect(primaryCount).toBe(1);
    const primary = links.find((l) => l.isPrimary);
    expect(primary?.supplierId).toBe(supplierBId);
  });
});
