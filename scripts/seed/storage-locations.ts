import type { PrismaClient } from "@prisma/client";

const LOCATIONS = [
  { code: "A-01-1",   name: "Trockenlager A/Regal 1",          zone: "Trocken", capacity: 40 },
  { code: "A-02-3",   name: "Trockenlager A/Regal 2/Fach 3",   zone: "Trocken", capacity: 30 },
  { code: "B-01-1",   name: "Trockenlager B/Regal 1",          zone: "Trocken", capacity: 120 },
  { code: "B-01-2",   name: "Trockenlager B/Regal 2",          zone: "Trocken", capacity: 40 },
  { code: "C-KUEHL-1", name: "Kühl C/Fach 1",                   zone: "Kühl",    capacity: 40 },
  { code: "C-KUEHL-2", name: "Kühl C/Fach 2",                   zone: "Kühl",    capacity: 8 },
  { code: "D-01-3",   name: "Trockenlager D/Regal 1/Fach 3",   zone: "Trocken", capacity: 50 },
];

// Map article SKU → default location code
const ARTICLE_LOCATION: Array<{ sku: string; locationCode: string }> = [
  { sku: "MEHL-550-25", locationCode: "A-02-3" },
  { sku: "ZUCK-KR-1",   locationCode: "B-01-1" },
  { sku: "SALZ-SIED-1", locationCode: "B-01-2" },
  { sku: "HEFE-FR-500", locationCode: "C-KUEHL-1" },
  { sku: "BUTTR-25",    locationCode: "C-KUEHL-2" },
  { sku: "SCHO-70-100", locationCode: "D-01-3" },
];

export async function seedStorageLocations(prisma: PrismaClient, tenantId: string): Promise<{ locations: number; assigned: number }> {
  for (const l of LOCATIONS) {
    await prisma.storageLocation.upsert({
      where: { tenantId_code: { tenantId, code: l.code } },
      update: { name: l.name, zone: l.zone, capacity: l.capacity, active: true },
      create: { tenantId, code: l.code, name: l.name, zone: l.zone, capacity: l.capacity, active: true },
    });
  }

  let assigned = 0;
  for (const m of ARTICLE_LOCATION) {
    const article = await prisma.article.findFirst({ where: { tenantId, sku: m.sku } });
    const loc = await prisma.storageLocation.findFirst({ where: { tenantId, code: m.locationCode } });
    if (!article || !loc) continue;
    if (article.defaultLocationId !== loc.id) {
      await prisma.article.update({ where: { id: article.id }, data: { defaultLocationId: loc.id } });
    }
    assigned++;
  }

  return { locations: LOCATIONS.length, assigned };
}
