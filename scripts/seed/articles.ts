import type { PrismaClient } from "@prisma/client";

/**
 * Idempotent seed for demo articles. Inspired by
 * `Docs/Klickdummy_Logistikverwaltung.html` (Mehl, Zucker, Salz, Hefe,
 * Butter, Kuvertüre).
 *
 * Natural key: (tenantId, sku) — matches the @@unique on the Article model.
 */
const ARTICLES = [
  {
    sku: "MEHL-550-25",
    name: "Weizenmehl Type 550",
    eanGtin: "4006381333931",
    category: "Mehl",
    baseUnit: "SACK",
    orderUnit: "PALLET",
    packFactor: 30,
    minStock: 30,
    vatRate: 7,
  },
  {
    sku: "ZUCK-KR-1",
    name: "Kristallzucker 1 kg",
    eanGtin: "4008400100005",
    category: "Zucker",
    baseUnit: "PACK",
    orderUnit: "BOX",
    packFactor: 10,
    minStock: 40,
    vatRate: 7,
  },
  {
    sku: "SALZ-SIED-1",
    name: "Siedesalz 1 kg",
    eanGtin: "4014400900101",
    category: "Salz",
    baseUnit: "PACK",
    orderUnit: "BOX",
    packFactor: 20,
    minStock: 20,
    vatRate: 7,
  },
  {
    sku: "HEFE-FR-500",
    name: "Frischhefe 500 g",
    eanGtin: "4002400500001",
    category: "Hefe",
    baseUnit: "PACK",
    orderUnit: "BOX",
    packFactor: 20,
    minStock: 15,
    vatRate: 7,
  },
  {
    sku: "BUTTR-25",
    name: "Butter 2,5 kg Block",
    eanGtin: "4011200250009",
    category: "Milchprodukte",
    baseUnit: "PACK",
    orderUnit: "BOX",
    packFactor: 8,
    minStock: 8,
    vatRate: 7,
  },
  {
    sku: "SCHO-70-100",
    name: "Kuvertüre 70% 1 kg",
    eanGtin: "4105500700019",
    category: "Schokolade",
    baseUnit: "PACK",
    orderUnit: "BOX",
    packFactor: 10,
    minStock: 20,
    vatRate: 19,
  },
] as const;

export async function seedArticles(prisma: PrismaClient, tenantId: string): Promise<number> {
  for (const a of ARTICLES) {
    await prisma.article.upsert({
      where: { tenantId_sku: { tenantId, sku: a.sku } },
      update: {
        name: a.name,
        eanGtin: a.eanGtin,
        category: a.category,
        baseUnit: a.baseUnit,
        orderUnit: a.orderUnit,
        packFactor: a.packFactor,
        barcodeSource: "SKU",
        minStock: a.minStock,
        vatRate: a.vatRate,
        active: true,
      },
      create: {
        tenantId,
        sku: a.sku,
        name: a.name,
        eanGtin: a.eanGtin,
        category: a.category,
        baseUnit: a.baseUnit,
        orderUnit: a.orderUnit,
        packFactor: a.packFactor,
        barcodeSource: "SKU",
        minStock: a.minStock,
        vatRate: a.vatRate,
        active: true,
      },
    });
  }
  return ARTICLES.length;
}
