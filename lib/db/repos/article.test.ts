import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db/client";
import { articleRepo } from "./article";

const TENANT_ID = "test-article-tenant";

async function cleanup() {
  await prisma.stockBalance.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.article.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.storageLocation.deleteMany({ where: { tenantId: TENANT_ID } });
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
  await prisma.stockBalance.deleteMany({ where: { tenantId: TENANT_ID } });
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

  it("belowMin filters by real total stock (< minStock), aggregated across locations", async () => {
    const loc1 = await prisma.storageLocation.create({ data: { tenantId: TENANT_ID, code: "BM-1", name: "Lager 1" } });
    const loc2 = await prisma.storageLocation.create({ data: { tenantId: TENANT_ID, code: "BM-2", name: "Lager 2" } });

    const ids: Record<string, string> = {};
    await prisma.$transaction(async (tx) => {
      for (const [sku, minStock] of [["LOW", 50], ["OK", 50], ["NOMIN", 0]] as const) {
        const a = await articleRepo.create(tx, TENANT_ID, {
          sku, name: sku, baseUnit: "KG", orderUnit: "SACK", packFactor: 25, barcodeSource: "SKU", minStock,
        });
        ids[sku] = a.id;
      }
    });

    // LOW: 10 total (< 50 → below). OK: 30+30=60 across two locations (≥ 50 → not below —
    // proves aggregation; a single location's 30 would wrongly look below). NOMIN: minStock 0 → excluded.
    await prisma.stockBalance.createMany({
      data: [
        { tenantId: TENANT_ID, articleId: ids.LOW, locationId: loc1.id, quantity: 10 },
        { tenantId: TENANT_ID, articleId: ids.OK, locationId: loc1.id, quantity: 30 },
        { tenantId: TENANT_ID, articleId: ids.OK, locationId: loc2.id, quantity: 30 },
        { tenantId: TENANT_ID, articleId: ids.NOMIN, locationId: loc1.id, quantity: 0 },
      ],
    });

    const below = await articleRepo.list({ tenantId: TENANT_ID, belowMin: true, page: 1, pageSize: 25 });
    expect(below.total).toBe(1);
    expect(below.items.map((a) => a.sku)).toEqual(["LOW"]);

    // An article with no stock row at all also counts as below (total = 0 < minStock).
    await prisma.stockBalance.deleteMany({ where: { tenantId: TENANT_ID, articleId: ids.OK } });
    const below2 = await articleRepo.list({ tenantId: TENANT_ID, belowMin: true, page: 1, pageSize: 25 });
    expect(below2.items.map((a) => a.sku).sort()).toEqual(["LOW", "OK"]);

    const all = await articleRepo.list({ tenantId: TENANT_ID, page: 1, pageSize: 25 });
    expect(all.total).toBe(3);
  });
});
