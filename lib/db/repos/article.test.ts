import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db/client";
import { articleRepo } from "./article";

const TENANT_ID = "test-article-tenant";

async function cleanup() {
  await prisma.article.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
}

beforeAll(async () => {
  await cleanup();
  await prisma.tenant.create({ data: { id: TENANT_ID, name: "test-article" } });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.article.deleteMany({ where: { tenantId: TENANT_ID } });
});

describe("articleRepo", () => {
  it("creates and finds by SKU", async () => {
    await prisma.$transaction(async (tx) => {
      await articleRepo.create(tx, TENANT_ID, {
        sku: "MEHL-T",
        name: "Mehl Test",
        baseUnit: "KG",
        orderUnit: "SACK",
        packFactor: 25,
        barcodeSource: "SKU",
        minStock: 10,
      });
    });
    const found = await articleRepo.findBySku(TENANT_ID, "MEHL-T");
    expect(found?.name).toBe("Mehl Test");
  });

  it("paginates the list", async () => {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < 5; i++) {
        await articleRepo.create(tx, TENANT_ID, {
          sku: `SKU-${i}`,
          name: `Artikel ${i}`,
          baseUnit: "PIECE",
          orderUnit: "BOX",
          packFactor: 10,
          barcodeSource: "SKU",
          minStock: 0,
        });
      }
    });
    const page1 = await articleRepo.list({ tenantId: TENANT_ID, page: 1, pageSize: 2 });
    expect(page1.items.length).toBe(2);
    expect(page1.total).toBe(5);
  });

  it("filters by search query", async () => {
    await prisma.$transaction(async (tx) => {
      await articleRepo.create(tx, TENANT_ID, {
        sku: "MEHL-S",
        name: "Weizenmehl",
        baseUnit: "KG",
        orderUnit: "SACK",
        packFactor: 25,
        barcodeSource: "SKU",
        minStock: 0,
      });
      await articleRepo.create(tx, TENANT_ID, {
        sku: "ZUCK-S",
        name: "Zucker",
        baseUnit: "KG",
        orderUnit: "SACK",
        packFactor: 25,
        barcodeSource: "SKU",
        minStock: 0,
      });
    });
    const result = await articleRepo.list({ tenantId: TENANT_ID, q: "mehl", page: 1, pageSize: 25 });
    expect(result.items.length).toBe(1);
    expect(result.items[0].sku).toBe("MEHL-S");
  });

  it("respects tenant isolation", async () => {
    await prisma.tenant.upsert({
      where: { id: "other-tenant-art" },
      update: {},
      create: { id: "other-tenant-art", name: "other-tenant-art" },
    });
    await prisma.$transaction(async (tx) => {
      await articleRepo.create(tx, "other-tenant-art", {
        sku: "OTHER-1",
        name: "Other",
        baseUnit: "PIECE",
        orderUnit: "BOX",
        packFactor: 1,
        barcodeSource: "SKU",
        minStock: 0,
      });
    });
    const result = await articleRepo.list({ tenantId: TENANT_ID, page: 1, pageSize: 25 });
    expect(result.items.find((a) => a.sku === "OTHER-1")).toBeUndefined();
    await prisma.article.deleteMany({ where: { tenantId: "other-tenant-art" } });
    await prisma.tenant.delete({ where: { id: "other-tenant-art" } });
  });
});
