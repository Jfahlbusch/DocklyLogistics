import type { PrismaClient } from "@prisma/client";
import { regenerateAutoSuggestions } from "../../lib/services/suggestion-engine";

export async function seedOrderSuggestions(prisma: PrismaClient, tenantId: string) {
  // The seed-stock already produced 6 balances. Some are below minStock
  // (MEHL-550-25 18 < 30, SALZ-SIED-1 8 < 20, BUTTR-25 3 < 8).
  // Calling the engine once is idempotent.
  const result = await prisma.$transaction((tx) =>
    regenerateAutoSuggestions(tx, tenantId, "seed"),
  );

  // Plus one MANUAL_SCAN demo suggestion that doesn't already exist.
  const mehl = await prisma.article.findFirst({ where: { tenantId, sku: "ZUCK-KR-1" } });
  const manualExists = mehl
    ? await prisma.orderSuggestion.findFirst({
        where: { tenantId, articleId: mehl.id, reason: "MANUAL_SCAN" },
      })
    : null;
  if (mehl && !manualExists) {
    await prisma.orderSuggestion.create({
      data: {
        tenantId,
        articleId: mehl.id,
        qtyOrderUnit: 2,
        reason: "MANUAL_SCAN",
        status: "PENDING",
        note: "Demo: Manuell aus Lagermodus erstellt",
        createdBy: "seed",
      },
    });
  }

  return result;
}
