import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { ArticleSupplierCreate } from "@/lib/schemas/supplier";

/**
 * ArticleSupplier has no own tenantId (join table) — tenant isolation is enforced
 * here via the `article` relation (`article: { tenantId }`) so the repo is safe by
 * itself (defense-in-depth), not only behind the route's ownership check.
 */
export const articleSupplierRepo = {
  async listForArticle(tenantId: string, articleId: string) {
    return prisma.articleSupplier.findMany({
      where: { articleId, article: { tenantId } },
      include: { supplier: true },
      orderBy: { isPrimary: "desc" },
    });
  },

  async findById(tenantId: string, id: string) {
    return prisma.articleSupplier.findFirst({ where: { id, article: { tenantId } } });
  },

  async findLink(tenantId: string, articleId: string, supplierId: string) {
    return prisma.articleSupplier.findFirst({
      where: { articleId, supplierId, article: { tenantId } },
    });
  },

  /**
   * Creates an ArticleSupplier link. If isPrimary=true, clears the flag from
   * any other ArticleSupplier row of the same article first, to honour the
   * partial-unique-index "ArticleSupplier_articleId_primary_unique".
   */
  async create(
    tx: Prisma.TransactionClient,
    tenantId: string,
    articleId: string,
    input: ArticleSupplierCreate,
  ) {
    if (input.isPrimary) {
      await tx.articleSupplier.updateMany({
        where: { articleId, isPrimary: true, article: { tenantId } },
        data: { isPrimary: false },
      });
    }
    return tx.articleSupplier.create({
      data: {
        articleId,
        supplierId: input.supplierId,
        purchasePrice: input.purchasePrice,
        currency: input.currency,
        isPrimary: input.isPrimary,
        leadTimeDays: input.leadTimeDays,
        minOrderQty: input.minOrderQty,
        supplierSku: input.supplierSku,
      },
    });
  },

  /**
   * Updates an ArticleSupplier link. If isPrimary=true, clears the flag from
   * any other ArticleSupplier row of the same article (excluding this link),
   * to honour the partial-unique-index "ArticleSupplier_articleId_primary_unique".
   * Callers must verify ownership via findById(tenantId, linkId) first — the
   * single-row update cannot carry a relation filter.
   */
  async update(
    tx: Prisma.TransactionClient,
    tenantId: string,
    articleId: string,
    linkId: string,
    input: { purchasePrice?: number; currency?: string; isPrimary?: boolean; leadTimeDays?: number; minOrderQty?: number; supplierSku?: string | null },
  ) {
    if (input.isPrimary === true) {
      await tx.articleSupplier.updateMany({
        where: { articleId, isPrimary: true, article: { tenantId }, NOT: { id: linkId } },
        data: { isPrimary: false },
      });
    }
    return tx.articleSupplier.update({
      where: { id: linkId },
      data: {
        ...(input.purchasePrice !== undefined ? { purchasePrice: input.purchasePrice } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
        ...(input.leadTimeDays !== undefined ? { leadTimeDays: input.leadTimeDays } : {}),
        ...(input.minOrderQty !== undefined ? { minOrderQty: input.minOrderQty } : {}),
        ...(input.supplierSku !== undefined ? { supplierSku: input.supplierSku ?? null } : {}),
      },
    });
  },

  /** Tenant-scoped delete via the article relation; returns the batch count. */
  async remove(tx: Prisma.TransactionClient, tenantId: string, id: string) {
    return tx.articleSupplier.deleteMany({ where: { id, article: { tenantId } } });
  },
};
