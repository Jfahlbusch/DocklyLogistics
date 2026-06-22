import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import { postInventory } from "./inventory";

const T = "test-inventory";
const mkArticle = (sku: string) =>
  prisma.article.create({
    data: { tenantId: T, sku, name: sku, baseUnit: "KG", orderUnit: "SACK", packFactor: 25, barcodeSource: "SKU", minStock: 0 },
  });

async function cleanup() {
  // StockMovement is append-only (trigger blocks DELETE); disable it transiently.
  await prisma.$executeRawUnsafe(`ALTER TABLE "StockMovement" DISABLE TRIGGER stockmovement_no_update`);
  try {
    await prisma.stockMovement.deleteMany({ where: { tenantId: T } });
  } finally {
    await prisma.$executeRawUnsafe(`ALTER TABLE "StockMovement" ENABLE TRIGGER stockmovement_no_update`);
  }
  await prisma.stockBalance.deleteMany({ where: { tenantId: T } });
  await prisma.article.deleteMany({ where: { tenantId: T } });
  await prisma.storageLocation.deleteMany({ where: { tenantId: T } });
  await prisma.tenant.deleteMany({ where: { id: T } });
}

describe("postInventory", () => {
  let articleId = "";
  let locationId = "";

  beforeAll(async () => {
    await cleanup();
    await prisma.tenant.create({ data: { id: T, name: T } });
    locationId = (await prisma.storageLocation.create({ data: { tenantId: T, code: "A-1", name: "Lager A" } })).id;
    articleId = (await mkArticle("INV-1")).id;
    await prisma.stockBalance.create({ data: { tenantId: T, articleId, locationId, quantity: 10 } });
  });

  afterAll(cleanup);

  it("adjusts the balance to the counted quantity and records an INVENTORY movement", async () => {
    const adj = await prisma.$transaction((tx) =>
      postInventory(tx, { tenantId: T, locationId, counts: [{ articleId, countedQty: 7 }], createdBy: "tester" }),
    );
    expect(adj).toHaveLength(1);
    expect(adj[0]).toMatchObject({ before: 10, counted: 7, delta: -3 });
    const bal = await prisma.stockBalance.findFirst({ where: { tenantId: T, articleId, locationId } });
    expect(bal?.quantity).toBe(7);
    const mv = await prisma.stockMovement.findFirst({ where: { tenantId: T, articleId, reason: "INVENTORY" } });
    expect(mv?.delta).toBe(-3);
  });

  it("skips an article whose count equals the current balance", async () => {
    const adj = await prisma.$transaction((tx) =>
      postInventory(tx, { tenantId: T, locationId, counts: [{ articleId, countedQty: 7 }], createdBy: "tester" }),
    );
    expect(adj).toHaveLength(0);
  });

  it("creates a balance for an article that had none", async () => {
    const art2 = await mkArticle("INV-2");
    const adj = await prisma.$transaction((tx) =>
      postInventory(tx, { tenantId: T, locationId, counts: [{ articleId: art2.id, countedQty: 5 }], createdBy: "tester" }),
    );
    expect(adj[0]).toMatchObject({ before: 0, counted: 5, delta: 5 });
    const bal = await prisma.stockBalance.findFirst({ where: { tenantId: T, articleId: art2.id, locationId } });
    expect(bal?.quantity).toBe(5);
  });
});
