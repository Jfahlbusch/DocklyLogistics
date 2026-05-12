import type { PrismaClient } from "@prisma/client";

const INIT_BALANCES: Array<{ sku: string; locationCode: string; quantity: number }> = [
  { sku: "MEHL-550-25", locationCode: "A-02-3",   quantity: 18 },
  { sku: "ZUCK-KR-1",   locationCode: "B-01-1",   quantity: 120 },
  { sku: "SALZ-SIED-1", locationCode: "B-01-2",   quantity: 8 },
  { sku: "HEFE-FR-500", locationCode: "C-KUEHL-1", quantity: 22 },
  { sku: "BUTTR-25",    locationCode: "C-KUEHL-2", quantity: 3 },
  { sku: "SCHO-70-100", locationCode: "D-01-3",   quantity: 35 },
];

export async function seedStock(prisma: PrismaClient, tenantId: string): Promise<{ balances: number; movements: number }> {
  // Idempotent: if a StockBalance row already exists for (article, location), we OVERWRITE quantity to the seed value
  // by adjusting via a corrective StockMovement (preserves the append-only invariant on Movements while leaving Balances upsertable).
  let balanceCount = 0;
  let movementCount = 0;
  for (const b of INIT_BALANCES) {
    const article = await prisma.article.findFirst({ where: { tenantId, sku: b.sku } });
    const location = await prisma.storageLocation.findFirst({ where: { tenantId, code: b.locationCode } });
    if (!article || !location) continue;

    const existing = await prisma.stockBalance.findFirst({
      where: { tenantId, articleId: article.id, locationId: location.id },
    });
    const currentQty = existing?.quantity ?? 0;
    const delta = b.quantity - currentQty;

    if (delta !== 0) {
      await prisma.$transaction(async (tx) => {
        if (existing) {
          await tx.stockBalance.update({ where: { id: existing.id }, data: { quantity: b.quantity } });
        } else {
          await tx.stockBalance.create({
            data: { tenantId, articleId: article.id, locationId: location.id, quantity: b.quantity },
          });
        }
        await tx.stockMovement.create({
          data: {
            tenantId,
            articleId: article.id,
            locationId: location.id,
            delta,
            reason: "INVENTORY",
            refType: "SEED",
            note: "Initialbestand aus Seed",
            createdBy: "seed",
          },
        });
      });
      movementCount++;
    }
    balanceCount++;
  }
  return { balances: balanceCount, movements: movementCount };
}
