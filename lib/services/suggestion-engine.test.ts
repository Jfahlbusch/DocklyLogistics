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

  // --- T1: Ist-Verhalten festschreiben -------------------------------------

  const articleBase = {
    tenantId: TENANT_ID,
    name: "Engine-Extra",
    baseUnit: "KG" as const,
    orderUnit: "SACK" as const,
    barcodeSource: "SKU" as const,
  };

  it("rundet die Menge auf ganze Packungen auf (Bestand 0 -> 50/25 = 2, Bestand 25 -> 1)", async () => {
    await prisma.$transaction((tx) => regenerateAutoSuggestions(tx, TENANT_ID, "test"));
    let s = await prisma.orderSuggestion.findMany({ where: { tenantId: TENANT_ID } });
    expect(s).toHaveLength(1);
    expect(s[0].qtyOrderUnit).toBe(2);

    await prisma.orderSuggestion.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.stockBalance.create({
      data: { tenantId: TENANT_ID, articleId, locationId, quantity: 25 },
    });
    await prisma.$transaction((tx) => regenerateAutoSuggestions(tx, TENANT_ID, "test"));
    s = await prisma.orderSuggestion.findMany({ where: { tenantId: TENANT_ID } });
    expect(s).toHaveLength(1);
    expect(s[0].qtyOrderUnit).toBe(1);
  });

  it("setzt supplierId auf null, wenn kein primaerer Lieferant existiert", async () => {
    const extra = await prisma.article.create({
      data: { ...articleBase, sku: "ENG-NOPRIM", packFactor: 1, minStock: 5 },
    });
    // Nicht-primaerer Lieferant zaehlt nicht.
    await prisma.articleSupplier.create({
      data: {
        articleId: extra.id,
        supplierId,
        purchasePrice: 1,
        currency: "EUR",
        isPrimary: false,
        leadTimeDays: 3,
        minOrderQty: 1,
      },
    });
    // Hauptartikel liegt ueber Minimum, damit nur der Extra-Artikel vorgeschlagen wird.
    await prisma.stockBalance.create({
      data: { tenantId: TENANT_ID, articleId, locationId, quantity: 60 },
    });
    try {
      const r = await prisma.$transaction((tx) =>
        regenerateAutoSuggestions(tx, TENANT_ID, "test"),
      );
      expect(r.created).toBe(1);
      const s = await prisma.orderSuggestion.findMany({ where: { tenantId: TENANT_ID } });
      expect(s).toHaveLength(1);
      expect(s[0].articleId).toBe(extra.id);
      expect(s[0].supplierId).toBeNull();
      expect(s[0].qtyOrderUnit).toBe(5);
      expect(s[0].status).toBe("PENDING");
    } finally {
      await prisma.orderSuggestion.deleteMany({ where: { tenantId: TENANT_ID } });
      await prisma.articleSupplier.deleteMany({ where: { articleId: extra.id } });
      await prisma.article.delete({ where: { id: extra.id } });
    }
  });

  it("erzeugt keinen Vorschlag bei minStock 0", async () => {
    const zero = await prisma.article.create({
      data: { ...articleBase, sku: "ENG-ZERO", packFactor: 1, minStock: 0 },
    });
    await prisma.stockBalance.create({
      data: { tenantId: TENANT_ID, articleId, locationId, quantity: 60 },
    });
    try {
      const r = await prisma.$transaction((tx) =>
        regenerateAutoSuggestions(tx, TENANT_ID, "test"),
      );
      expect(r.created).toBe(0);
      expect(r.skippedAtOrAboveMin).toBe(2);
      expect(await prisma.orderSuggestion.count({ where: { tenantId: TENANT_ID } })).toBe(0);
    } finally {
      await prisma.article.delete({ where: { id: zero.id } });
    }
  });

  it("legt keinen zweiten Vorschlag an, wenn bereits ein offener AUTO_MIN_STOCK existiert", async () => {
    await prisma.stockBalance.create({
      data: { tenantId: TENANT_ID, articleId, locationId, quantity: 10 },
    });
    await prisma.orderSuggestion.create({
      data: {
        tenantId: TENANT_ID,
        articleId,
        qtyOrderUnit: 7,
        reason: "AUTO_MIN_STOCK",
        status: "PENDING",
        createdBy: "seed",
      },
    });
    const r = await prisma.$transaction((tx) =>
      regenerateAutoSuggestions(tx, TENANT_ID, "test"),
    );
    expect(r.created).toBe(0);
    expect(r.skippedAlreadyPending).toBe(1);
    const all = await prisma.orderSuggestion.findMany({ where: { tenantId: TENANT_ID } });
    expect(all).toHaveLength(1);
    expect(all[0].qtyOrderUnit).toBe(7); // bestehender Vorschlag bleibt unveraendert
  });

  it("erzeugt neuen Vorschlag, wenn der vorhandene AUTO_MIN_STOCK nicht mehr PENDING ist", async () => {
    await prisma.stockBalance.create({
      data: { tenantId: TENANT_ID, articleId, locationId, quantity: 10 },
    });
    await prisma.orderSuggestion.create({
      data: {
        tenantId: TENANT_ID,
        articleId,
        qtyOrderUnit: 2,
        reason: "AUTO_MIN_STOCK",
        status: "DISMISSED",
        createdBy: "seed",
      },
    });
    const r = await prisma.$transaction((tx) =>
      regenerateAutoSuggestions(tx, TENANT_ID, "test"),
    );
    expect(r.created).toBe(1);
    expect(
      await prisma.orderSuggestion.count({ where: { tenantId: TENANT_ID, status: "PENDING" } }),
    ).toBe(1);
  });

  // F-B1, wird in T4 behoben: Heute ignoriert die Engine einen offenen
  // MANUAL_SCAN-Vorschlag und legt einen zweiten offenen Vorschlag an.
  // Korrektes Verhalten: genau ein offener Vorschlag je Artikel.
  it.fails("F-B1: offener MANUAL_SCAN + Engine-Lauf -> genau ein offener Vorschlag", async () => {
    await prisma.stockBalance.create({
      data: { tenantId: TENANT_ID, articleId, locationId, quantity: 10 },
    });
    await prisma.orderSuggestion.create({
      data: {
        tenantId: TENANT_ID,
        articleId,
        qtyOrderUnit: 3,
        reason: "MANUAL_SCAN",
        status: "PENDING",
        createdBy: "seed",
      },
    });
    await prisma.$transaction((tx) => regenerateAutoSuggestions(tx, TENANT_ID, "test"));
    const open = await prisma.orderSuggestion.findMany({
      where: { tenantId: TENANT_ID, articleId, status: "PENDING" },
    });
    expect(open).toHaveLength(1);
  });
});
