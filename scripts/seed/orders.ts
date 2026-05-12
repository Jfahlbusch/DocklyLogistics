import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { nextOrderNo } from "../../lib/services/order-number";

type OrderSeed = {
  supplierName: string;
  status: "REVIEW" | "SENT" | "CONFIRMED" | "RECEIVED";
  items: Array<{ sku: string; qtyOrderUnit: number; unitPrice: number }>;
  notes?: string;
};

const ORDERS: OrderSeed[] = [
  {
    supplierName: "Mühle Müller GmbH", status: "SENT",
    items: [{ sku: "MEHL-550-25", qtyOrderUnit: 1, unitPrice: 14.80 }],
    notes: "Wöchentliche Mehl-Bestellung",
  },
  {
    supplierName: "Südzucker Handel", status: "CONFIRMED",
    items: [
      { sku: "ZUCK-KR-1", qtyOrderUnit: 4, unitPrice: 1.12 },
      { sku: "SALZ-SIED-1", qtyOrderUnit: 1, unitPrice: 0.68 },
    ],
    notes: "Standardlieferung Anfang Monat",
  },
  {
    supplierName: "Mühle Müller GmbH", status: "REVIEW",
    items: [{ sku: "MEHL-550-25", qtyOrderUnit: 2, unitPrice: 14.80 }],
    notes: "Erweiterte Bestellung — wartet auf Freigabe",
  },
];

export async function seedOrders(prisma: PrismaClient, tenantId: string): Promise<{ orders: number; skipped: number }> {
  let created = 0; let skipped = 0;
  for (const seed of ORDERS) {
    const supplier = await prisma.supplier.findFirst({ where: { tenantId, name: seed.supplierName } });
    if (!supplier) { skipped++; continue; }
    // Idempotency check: same supplier+status+exact item set already present?
    const existing = await prisma.order.findFirst({
      where: { tenantId, supplierId: supplier.id, status: seed.status, items: { every: { article: { sku: { in: seed.items.map((i) => i.sku) } } } } },
      include: { items: { include: { article: { select: { sku: true } } } } },
    });
    if (existing && existing.items.length === seed.items.length) {
      const skus = existing.items.map((i) => i.article.sku).sort();
      const wanted = seed.items.map((i) => i.sku).sort();
      if (JSON.stringify(skus) === JSON.stringify(wanted)) { skipped++; continue; }
    }

    await prisma.$transaction(async (tx) => {
      const orderNo = await nextOrderNo(tx, tenantId);
      // Resolve articles
      const articles = await tx.article.findMany({ where: { tenantId, sku: { in: seed.items.map((i) => i.sku) } } });
      const bySku = new Map(articles.map((a) => [a.sku, a]));
      const enriched = seed.items.map((i) => {
        const a = bySku.get(i.sku);
        if (!a) throw new Error(`Article ${i.sku} not found in seed`);
        return {
          articleId: a.id,
          qtyOrderUnit: i.qtyOrderUnit,
          qtyBase: i.qtyOrderUnit * a.packFactor,
          unitPrice: new Prisma.Decimal(i.unitPrice),
          lineTotal: new Prisma.Decimal(i.qtyOrderUnit * i.unitPrice),
        };
      });
      const total = enriched.reduce((s, x) => s + Number(x.lineTotal), 0);

      const order = await tx.order.create({
        data: {
          tenantId, orderNo, supplierId: supplier.id, status: seed.status, currency: "EUR",
          total: new Prisma.Decimal(total), notes: seed.notes ?? null, createdBy: "seed",
          items: { create: enriched },
          ...(seed.status === "SENT" || seed.status === "CONFIRMED" ? { sentAt: new Date() } : {}),
          ...(seed.status === "CONFIRMED" ? { confirmedAt: new Date() } : {}),
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId: order.id, type: "CREATED", toStatus: "REVIEW",
          actorId: "seed", actorEmail: "seed@docklylogistics.demo",
          payload: { orderNo, supplierId: supplier.id, source: "seed" },
        },
      });
      if (seed.status !== "REVIEW") {
        await tx.orderEvent.create({
          data: {
            orderId: order.id, type: "STATUS_CHANGED", fromStatus: "REVIEW", toStatus: seed.status,
            actorId: "seed", actorEmail: "seed@docklylogistics.demo",
            payload: { source: "seed" },
          },
        });
      }
    });
    created++;
  }
  return { orders: created, skipped };
}
