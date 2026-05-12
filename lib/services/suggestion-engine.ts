import type { Prisma } from "@prisma/client";

type EngineResult = {
  created: number;
  skippedAlreadyPending: number;
  skippedAtOrAboveMin: number;
};

/**
 * Recompute AUTO_MIN_STOCK suggestions for every article whose total stock is below minStock.
 * For each such article, create a PENDING suggestion if none already exists.
 * Quantity is ceil((minStock - currentStock) / packFactor), in OrderUnit.
 * Primary supplier (ArticleSupplier.isPrimary=true) is preselected, else null.
 */
export async function regenerateAutoSuggestions(
  tx: Prisma.TransactionClient,
  tenantId: string,
  createdBy: string,
): Promise<EngineResult> {
  const articles = await tx.article.findMany({
    where: { tenantId, active: true },
    select: { id: true, sku: true, name: true, minStock: true, packFactor: true },
  });

  const ids = articles.map((a) => a.id);
  // We can't use stockRepo.totalsByArticle inside a TransactionClient (it uses prisma directly).
  // Reimplement the aggregation against tx.
  const rows = await tx.stockBalance.groupBy({
    by: ["articleId"],
    where: { tenantId, articleId: { in: ids } },
    _sum: { quantity: true },
  });
  const totals = new Map(rows.map((r) => [r.articleId, r._sum.quantity ?? 0]));

  // Existing PENDING auto suggestions to avoid duplicates
  const existing = await tx.orderSuggestion.findMany({
    where: { tenantId, status: "PENDING", reason: "AUTO_MIN_STOCK" },
    select: { articleId: true },
  });
  const existingArticles = new Set(existing.map((s) => s.articleId));

  // Primary supplier lookup
  const primaries = await tx.articleSupplier.findMany({
    where: { isPrimary: true, articleId: { in: ids } },
    select: { articleId: true, supplierId: true },
  });
  const primaryByArticle = new Map(primaries.map((p) => [p.articleId, p.supplierId]));

  let created = 0;
  let skippedAlreadyPending = 0;
  let skippedAtOrAboveMin = 0;

  for (const a of articles) {
    if (a.minStock <= 0) {
      skippedAtOrAboveMin++;
      continue;
    }
    const current = totals.get(a.id) ?? 0;
    if (current >= a.minStock) {
      skippedAtOrAboveMin++;
      continue;
    }
    if (existingArticles.has(a.id)) {
      skippedAlreadyPending++;
      continue;
    }

    const shortfall = a.minStock - current;
    const qty = Math.max(1, Math.ceil(shortfall / Math.max(1, a.packFactor)));

    await tx.orderSuggestion.create({
      data: {
        tenantId,
        articleId: a.id,
        supplierId: primaryByArticle.get(a.id) ?? null,
        qtyOrderUnit: qty,
        reason: "AUTO_MIN_STOCK",
        status: "PENDING",
        createdBy,
      },
    });
    created++;
  }

  return { created, skippedAlreadyPending, skippedAtOrAboveMin };
}
