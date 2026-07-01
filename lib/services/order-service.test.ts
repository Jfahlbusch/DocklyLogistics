import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db/client";
import { orderService, OrderStatusError } from "./order-service";

const TENANT_ID = "test-order-tenant";
let articleId = "";
let supplierId = "";

async function disableOrderEventTrigger() {
  await prisma.$executeRawUnsafe('ALTER TABLE "OrderEvent" DISABLE TRIGGER orderevent_no_update;');
}
async function enableOrderEventTrigger() {
  await prisma.$executeRawUnsafe('ALTER TABLE "OrderEvent" ENABLE TRIGGER orderevent_no_update;');
}

async function cleanup() {
  await disableOrderEventTrigger();
  // Scoped to THIS test tenant: the orderNo counter counts per tenant+year
  // (nextOrderNo filters on tenantId), so wiping our own orders is enough for
  // the 0001 expectation — and parallel test files keep their orders. A global
  // deleteMany({}) here used to race the edi-service tests.
  await prisma.orderEvent.deleteMany({ where: { order: { tenantId: TENANT_ID } } });
  await enableOrderEventTrigger();
  await prisma.orderItem.deleteMany({ where: { order: { tenantId: TENANT_ID } } });
  await prisma.order.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.articleSupplier.deleteMany({ where: { article: { tenantId: TENANT_ID } } });
  await prisma.supplier.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.article.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
}

beforeAll(async () => {
  await cleanup();
  await prisma.tenant.create({ data: { id: TENANT_ID, name: "test-order" } });
  const a = await prisma.article.create({ data: { tenantId: TENANT_ID, sku: "TEST-O", name: "T", baseUnit: "KG", orderUnit: "SACK", packFactor: 25, barcodeSource: "SKU", minStock: 0 } });
  articleId = a.id;
  const s = await prisma.supplier.create({ data: { tenantId: TENANT_ID, name: "Test-Sup", channel: "EMAIL", channelConfig: {}, active: true } });
  supplierId = s.id;
});

afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

beforeEach(async () => {
  await disableOrderEventTrigger();
  await prisma.orderEvent.deleteMany({ where: { order: { tenantId: TENANT_ID } } });
  await enableOrderEventTrigger();
  await prisma.orderItem.deleteMany({ where: { order: { tenantId: TENANT_ID } } });
  await prisma.order.deleteMany({ where: { tenantId: TENANT_ID } });
});

describe("orderService.create", () => {
  it("creates an order in REVIEW with computed total", async () => {
    const order = await prisma.$transaction((tx) => orderService.create(tx, {
      tenantId: TENANT_ID, supplierId, items: [{ articleId, qtyOrderUnit: 2, unitPrice: 10 }],
      createdBy: "test", actorId: "test", actorEmail: "test@x.de",
    }));
    expect(order.status).toBe("REVIEW");
    expect(Number(order.total)).toBe(20);
    expect(order.orderNo).toMatch(/^ORD-\d{4}-0001$/);
  });

  it("increments orderNo per tenant+year", async () => {
    await prisma.$transaction((tx) => orderService.create(tx, {
      tenantId: TENANT_ID, supplierId, items: [{ articleId, qtyOrderUnit: 1, unitPrice: 1 }],
      createdBy: "t", actorId: "t", actorEmail: "t@x",
    }));
    const second = await prisma.$transaction((tx) => orderService.create(tx, {
      tenantId: TENANT_ID, supplierId, items: [{ articleId, qtyOrderUnit: 1, unitPrice: 1 }],
      createdBy: "t", actorId: "t", actorEmail: "t@x",
    }));
    expect(second.orderNo).toMatch(/^ORD-\d{4}-0002$/);
  });

  it("records a CREATED event with toStatus REVIEW", async () => {
    const order = await prisma.$transaction((tx) => orderService.create(tx, {
      tenantId: TENANT_ID, supplierId, items: [{ articleId, qtyOrderUnit: 1, unitPrice: 5 }],
      createdBy: "t", actorId: "t", actorEmail: "t@x",
    }));
    const events = await prisma.orderEvent.findMany({ where: { orderId: order.id } });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("CREATED");
    expect(events[0].toStatus).toBe("REVIEW");
  });
});

describe("orderService.transition", () => {
  it("allows REVIEW → APPROVED", async () => {
    const order = await prisma.$transaction((tx) => orderService.create(tx, {
      tenantId: TENANT_ID, supplierId, items: [{ articleId, qtyOrderUnit: 1, unitPrice: 5 }],
      createdBy: "t", actorId: "t", actorEmail: "t@x",
    }));
    const updated = await prisma.$transaction((tx) => orderService.transition(tx, {
      orderId: order.id, to: "APPROVED", actorId: "t", actorEmail: "t@x", eventType: "STATUS_CHANGED",
    }));
    expect(updated.status).toBe("APPROVED");
  });

  it("blocks illegal transition (REVIEW → RECEIVED)", async () => {
    const order = await prisma.$transaction((tx) => orderService.create(tx, {
      tenantId: TENANT_ID, supplierId, items: [{ articleId, qtyOrderUnit: 1, unitPrice: 5 }],
      createdBy: "t", actorId: "t", actorEmail: "t@x",
    }));
    await expect(
      prisma.$transaction((tx) => orderService.transition(tx, {
        orderId: order.id, to: "RECEIVED", actorId: "t", actorEmail: "t@x", eventType: "STATUS_CHANGED",
      })),
    ).rejects.toThrow(OrderStatusError);
  });
});

describe("OrderEvent append-only trigger", () => {
  it("blocks UPDATE on OrderEvent", async () => {
    const order = await prisma.$transaction((tx) => orderService.create(tx, {
      tenantId: TENANT_ID, supplierId, items: [{ articleId, qtyOrderUnit: 1, unitPrice: 5 }],
      createdBy: "t", actorId: "t", actorEmail: "t@x",
    }));
    const event = await prisma.orderEvent.findFirst({ where: { orderId: order.id } });
    expect(event).not.toBeNull();
    await expect(
      prisma.orderEvent.update({ where: { id: event!.id }, data: { type: "HAXX" } }),
    ).rejects.toThrow(/Append-only/);
  });
});
