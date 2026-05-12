import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { ArticleSupplierCreate } from "@/lib/schemas/supplier";

export const articleSupplierRepo = {
  async listForArticle(articleId: string) {
    return prisma.articleSupplier.findMany({
      where: { articleId },
      include: { supplier: true },
      orderBy: { isPrimary: "desc" },
    });
  },

  async findById(id: string) {
    return prisma.articleSupplier.findUnique({ where: { id } });
  },

  async findLink(articleId: string, supplierId: string) {
    return prisma.articleSupplier.findUnique({
      where: { articleId_supplierId: { articleId, supplierId } },
    });
  },

  /**
   * Creates an ArticleSupplier link. If isPrimary=true, clears the flag from
   * any other ArticleSupplier row of the same article first, to honour the
   * partial-unique-index "ArticleSupplier_articleId_primary_unique".
   */
  async create(tx: Prisma.TransactionClient, articleId: string, input: ArticleSupplierCreate) {
    if (input.isPrimary) {
      await tx.articleSupplier.updateMany({
        where: { articleId, isPrimary: true },
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
   */
  async update(
    tx: Prisma.TransactionClient,
    articleId: string,
    linkId: string,
    input: { purchasePrice?: number; currency?: string; isPrimary?: boolean; leadTimeDays?: number; minOrderQty?: number; supplierSku?: string | null },
  ) {
    if (input.isPrimary === true) {
      await tx.articleSupplier.updateMany({
        where: { articleId, isPrimary: true, NOT: { id: linkId } },
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

  async remove(tx: Prisma.TransactionClient, id: string) {
    return tx.articleSupplier.delete({ where: { id } });
  },
};
