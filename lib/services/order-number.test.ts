import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/db/client";
import { orderService } from "./order-service";

/**
 * Bestellnummern werden **pro Mandant** vergeben (nextOrderNo filtert auf
 * tenantId). Damit muss auch die Eindeutigkeit pro Mandant gelten: Zwei
 * Mandanten dürfen beide ihre erste Bestellung des Jahres anlegen — beide
 * heißen dann ORD-JJJJ-0001, und das ist fachlich korrekt.
 */

const SUFFIX = crypto.randomBytes(4).toString("hex");
const A = `test-ordno-a-${SUFFIX}`;
const B = `test-ordno-b-${SUFFIX}`;
const TENANTS = [A, B];

const ids: Record<string, { articleId: string; supplierId: string }> = {};

async function cleanup() {
  await prisma.$executeRawUnsafe('ALTER TABLE "OrderEvent" DISABLE TRIGGER orderevent_no_update;');
  await prisma.orderEvent.deleteMany({ where: { order: { tenantId: { in: TENANTS } } } });
  await prisma.$executeRawUnsafe('ALTER TABLE "OrderEvent" ENABLE TRIGGER orderevent_no_update;');
  await prisma.orderItem.deleteMany({ where: { order: { tenantId: { in: TENANTS } } } });
  await prisma.order.deleteMany({ where: { tenantId: { in: TENANTS } } });
  await prisma.articleSupplier.deleteMany({ where: { article: { tenantId: { in: TENANTS } } } });
  await prisma.supplier.deleteMany({ where: { tenantId: { in: TENANTS } } });
  await prisma.article.deleteMany({ where: { tenantId: { in: TENANTS } } });
  await prisma.tenant.deleteMany({ where: { id: { in: TENANTS } } });
}

beforeAll(async () => {
  await cleanup();
  for (const t of TENANTS) {
    await prisma.tenant.create({ data: { id: t, name: t } });
    const a = await prisma.article.create({
      data: {
        tenantId: t, sku: `ORDNO-${t}`, name: "Testartikel",
        baseUnit: "KG", orderUnit: "SACK", packFactor: 25, barcodeSource: "SKU",
      },
    });
    const s = await prisma.supplier.create({
      data: { tenantId: t, name: `Lieferant ${t}`, channel: "EMAIL", channelConfig: {}, active: true },
    });
    ids[t] = { articleId: a.id, supplierId: s.id };
  }
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

function createFor(tenantId: string) {
  return prisma.$transaction((tx) =>
    orderService.create(tx, {
      tenantId,
      supplierId: ids[tenantId].supplierId,
      items: [{ articleId: ids[tenantId].articleId, qtyOrderUnit: 1, unitPrice: 10 }],
      createdBy: "test",
      actorId: "test",
      actorEmail: "test@x.de",
    }),
  );
}

describe("Bestellnummern-Vergabe über Mandanten hinweg", () => {
  it("lässt zwei Mandanten dieselbe laufende Nummer vergeben", async () => {
    const first = await createFor(A);
    const year = new Date().getFullYear();
    expect(first.orderNo).toBe(`ORD-${year}-0001`);

    // Der zweite Mandant beginnt bei 0001 — ein globaler Unique-Index auf
    // orderNo würde hier scheitern und die Bestellanlage des zweiten
    // Mandanten dauerhaft blockieren.
    const second = await createFor(B);
    expect(second.orderNo).toBe(`ORD-${year}-0001`);
    expect(second.tenantId).toBe(B);
  });

  it("zählt je Mandant unabhängig weiter", async () => {
    const year = new Date().getFullYear();
    const a2 = await createFor(A);
    expect(a2.orderNo).toBe(`ORD-${year}-0002`);

    const b2 = await createFor(B);
    expect(b2.orderNo).toBe(`ORD-${year}-0002`); // nicht 0003 — kein globaler Zähler
  });

  it("hält die Nummer innerhalb eines Mandanten eindeutig", async () => {
    const existing = await prisma.order.findFirst({ where: { tenantId: A } });
    await expect(
      prisma.order.create({
        data: {
          tenantId: A, orderNo: existing!.orderNo, supplierId: ids[A].supplierId,
          status: "REVIEW", total: 0, createdBy: "test",
        },
      }),
    ).rejects.toThrow(); // Doppelvergabe im selben Mandanten bleibt verboten
  });
});
