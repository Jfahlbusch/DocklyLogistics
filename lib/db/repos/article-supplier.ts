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

  async remove(tx: Prisma.TransactionClient, id: string) {
    return tx.articleSupplier.delete({ where: { id } });
  },
};
