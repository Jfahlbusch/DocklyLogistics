import type { PrismaClient } from "@prisma/client";

const SUPPLIERS = [
  {
    name: "Mühle Müller GmbH", contactName: "Anna Müller",
    email: "orders@muehle-mueller.de", phone: "+49 511 1234567",
    street: "Mühlenweg 12", city: "Hannover", postalCode: "30159", country: "DE",
    channel: "EMAIL" as const,
    channelConfig: { to: "orders@muehle-mueller.de", subject: "Bestellung DocklyLogistics" },
  },
  {
    name: "Südzucker Handel", contactName: "Tom Keller",
    email: "b2b@suedzucker.de", phone: "+49 621 9988776",
    street: "Maximilianstraße 10", city: "Mannheim", postalCode: "68165", country: "DE",
    channel: "API" as const,
    channelConfig: {
      url: "https://api.suedzucker.de/b2b/orders",
      auth: { type: "bearer", token: "demo-token" },
    },
  },
  {
    name: "Uniferm", contactName: "Vertrieb",
    email: "edi@uniferm.de", phone: "+49 2389 1234",
    street: "Industriestraße 5", city: "Werne", postalCode: "59368", country: "DE",
    channel: "EDI" as const,
    channelConfig: {
      partnerId: "9999000123",
      mailbox: "sftp.uniferm.de:/orders/",
      edifactVersion: "D.96A",
    },
  },
];

// Article SKU → primary supplier name + price
const LINKS: Array<{ articleSku: string; supplierName: string; price: number; isPrimary: boolean }> = [
  { articleSku: "MEHL-550-25", supplierName: "Mühle Müller GmbH", price: 14.80, isPrimary: true },
  { articleSku: "ZUCK-KR-1",   supplierName: "Südzucker Handel",  price: 1.12,  isPrimary: true },
  { articleSku: "SALZ-SIED-1", supplierName: "Südzucker Handel",  price: 0.68,  isPrimary: true },
  { articleSku: "HEFE-FR-500", supplierName: "Uniferm",            price: 1.90,  isPrimary: true },
];

export async function seedSuppliers(prisma: PrismaClient, tenantId: string): Promise<{ suppliers: number; links: number }> {
  for (const s of SUPPLIERS) {
    await prisma.supplier.upsert({
      where: { tenantId_name: { tenantId, name: s.name } },
      update: {
        contactName: s.contactName, email: s.email, phone: s.phone,
        street: s.street, city: s.city, postalCode: s.postalCode, country: s.country,
        channel: s.channel, channelConfig: s.channelConfig, active: true,
      },
      create: {
        tenantId, name: s.name,
        contactName: s.contactName, email: s.email, phone: s.phone,
        street: s.street, city: s.city, postalCode: s.postalCode, country: s.country,
        channel: s.channel, channelConfig: s.channelConfig, active: true,
      },
    });
  }

  let linkCount = 0;
  for (const link of LINKS) {
    const article = await prisma.article.findFirst({ where: { tenantId, sku: link.articleSku } });
    const supplier = await prisma.supplier.findFirst({ where: { tenantId, name: link.supplierName } });
    if (!article || !supplier) {
      console.warn(`[seed/suppliers] skip link: article ${link.articleSku} or supplier ${link.supplierName} not found`);
      continue;
    }

    // Clear existing isPrimary for this article so the partial-unique-index is honoured
    if (link.isPrimary) {
      await prisma.articleSupplier.updateMany({
        where: { articleId: article.id, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    await prisma.articleSupplier.upsert({
      where: { articleId_supplierId: { articleId: article.id, supplierId: supplier.id } },
      update: { purchasePrice: link.price, isPrimary: link.isPrimary },
      create: {
        articleId: article.id, supplierId: supplier.id,
        purchasePrice: link.price, currency: "EUR",
        isPrimary: link.isPrimary, leadTimeDays: 3, minOrderQty: 1,
      },
    });
    linkCount++;
  }

  return { suppliers: SUPPLIERS.length, links: linkCount };
}
