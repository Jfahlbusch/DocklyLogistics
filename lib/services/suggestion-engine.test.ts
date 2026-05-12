import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db/client";
import { regenerateAutoSuggestions } from "./suggestion-engine";

const TENANT_ID = "test-engine-tenant";
let articleId = "";
let locationId = "";
let supplierId = "";

async function cleanup() {
  await prisma.orderSuggestion.deleteMany({ where: { tenantId: TENANT_ID } });
  // The engine never creates StockMovement rows, so we don't need to touch the
  // append-only trigger. (Doing so would race with parallel test files.)
  await prisma.stockBalance.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.articleSupplier.deleteMany({ where: { article: { tenantId: TENANT_ID } } });
  await prisma.supplier.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.article.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.storageLocation.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
}

beforeAll(async () => {
  await cleanup();
  await prisma.tenant.create({ data: { id: TENANT_ID, name: "test-engine" } });
  const a = await prisma.article.create({
    data: {
      tenantId: TENANT_ID,
      sku: "ENG-1",
      name: "Engine-Test",
      baseUnit: "KG",
      orderUnit: "SACK",
      packFactor: 25,
      barcodeSource: "SKU",
      minStock: 50,
    },
  });
  articleId = a.id;
  const l = await prisma.storageLocation.create({
    data: { tenantId: TENANT_ID, code: "L-ENG", name: "L" },
  });
  locationId = l.id;
  const s = await prisma.supplier.create({
    data: {
      tenantId: TENANT_ID,
      name: "Eng-Supplier",
      channel: "EMAIL",
      channelConfig: {},
      active: true,
    },
  });
  supplierId = s.id;
  await prisma.articleSupplier.create({
    data: {
      articleId,
      supplierId,
      purchasePrice: 1,
      currency: "EUR",
      isPrimary: true,
      leadTimeDays: 3,
      minOrderQty: 1,
    },
  });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.orderSuggestion.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.stockBalance.deleteMany({ where: { tenantId: TENANT_ID } });
});

describe("regenerateAutoSuggestions", () => {
  it("creates a suggestion when stock is below minStock", async () => {
    await prisma.stockBalance.create({
      data: { tenantId: TENANT_ID, articleId, locationId, quantity: 10 },
    });
    const r = await prisma.$transaction((tx) =>
      regenerateAutoSuggestions(tx, TENANT_ID, "test"),
    );
    expect(r.created).toBe(1);
    const suggestions = await prisma.orderSuggestion.findMany({
      where: { tenantId: TENANT_ID },
    });
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].articleId).toBe(articleId);
    expect(suggestions[0].supplierId).toBe(supplierId);
    expect(suggestions[0].reason).toBe("AUTO_MIN_STOCK");
    // shortfall = 50 - 10 = 40, packFactor = 25, qty = ceil(40/25) = 2
    expect(suggestions[0].qtyOrderUnit).toBe(2);
  });

  it("does not duplicate suggestions for the same article on re-run", async () => {
    await prisma.stockBalance.create({
      data: { tenantId: TENANT_ID, articleId, locationId, quantity: 10 },
    });
    await prisma.$transaction((tx) => regenerateAutoSuggestions(tx, TENANT_ID, "test"));
    const r2 = await prisma.$transaction((tx) =>
      regenerateAutoSuggestions(tx, TENANT_ID, "test"),
    );
    expect(r2.created).toBe(0);
    expect(r2.skippedAlreadyPending).toBe(1);
    const all = await prisma.orderSuggestion.findMany({ where: { tenantId: TENANT_ID } });
    expect(all).toHaveLength(1);
  });

  it("skips articles with stock at or above minStock", async () => {
    await prisma.stockBalance.create({
      data: { tenantId: TENANT_ID, articleId, locationId, quantity: 60 },
    });
    const r = await prisma.$transaction((tx) =>
      regenerateAutoSuggestions(tx, TENANT_ID, "test"),
    );
    expect(r.created).toBe(0);
    expect(r.skippedAtOrAboveMin).toBe(1);
  });
});
