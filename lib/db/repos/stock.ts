import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";

type ListBalancesArgs = {
  tenantId: string;
  articleId?: string;
  locationId?: string;
  page: number;
  pageSize: number;
};

export const stockRepo = {
  async listBalances({ tenantId, articleId, locationId, page, pageSize }: ListBalancesArgs) {
    const where: Prisma.StockBalanceWhereInput = {
      tenantId,
      ...(articleId ? { articleId } : {}),
      ...(locationId ? { locationId } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.stockBalance.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          article: { select: { sku: true, name: true, minStock: true } },
          location: { select: { code: true, name: true, zone: true } },
        },
        orderBy: [{ article: { name: "asc" } }, { location: { code: "asc" } }],
      }),
      prisma.stockBalance.count({ where }),
    ]);
    return { items, total };
  },

  /** Total stock for each articleId in the tenant, aggregated across all locations. */
  async totalsByArticle(tenantId: string, articleIds?: string[]): Promise<Map<string, number>> {
    const rows = await prisma.stockBalance.groupBy({
      by: ["articleId"],
      where: {
        tenantId,
        ...(articleIds && articleIds.length > 0 ? { articleId: { in: articleIds } } : {}),
      },
      _sum: { quantity: true },
    });
    return new Map(rows.map((r) => [r.articleId, r._sum.quantity ?? 0]));
  },

  async findBalance(tenantId: string, articleId: string, locationId: string) {
    return prisma.stockBalance.findFirst({ where: { tenantId, articleId, locationId } });
  },

  async listMovementsForArticle({
    tenantId,
    articleId,
    locationId,
    page,
    pageSize,
  }: {
    tenantId: string;
    articleId: string;
    locationId?: string;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.StockMovementWhereInput = {
      tenantId,
      articleId,
      ...(locationId ? { locationId } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { location: { select: { code: true, name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.stockMovement.count({ where }),
    ]);
    return { items, total };
  },

  /**
   * Apply a delta to a (article, location) balance, recording the StockMovement.
   * Throws InsufficientStockError when the resulting balance would be < 0.
   *
   * MUST be called inside a Prisma transaction so the StockMovement insert
   * and the StockBalance upsert/update commit atomically.
   */
  async applyDelta(
    tx: Prisma.TransactionClient,
    args: {
      tenantId: string;
      articleId: string;
      locationId: string;
      delta: number;
      reason: string;
      refType?: string | null;
      refId?: string | null;
      note?: string | null;
      createdBy: string;
    },
  ) {
    const existing = await tx.stockBalance.findFirst({
      where: { tenantId: args.tenantId, articleId: args.articleId, locationId: args.locationId },
    });
    const currentQty = existing?.quantity ?? 0;
    const newQty = currentQty + args.delta;
    if (newQty < 0) {
      throw new InsufficientStockError(
        `Bestand würde negativ werden (${currentQty} + ${args.delta} = ${newQty})`,
      );
    }

    const balance = existing
      ? await tx.stockBalance.update({ where: { id: existing.id }, data: { quantity: newQty } })
      : await tx.stockBalance.create({
          data: {
            tenantId: args.tenantId,
            articleId: args.articleId,
            locationId: args.locationId,
            quantity: newQty,
          },
        });

    const movement = await tx.stockMovement.create({
      data: {
        tenantId: args.tenantId,
        articleId: args.articleId,
        locationId: args.locationId,
        delta: args.delta,
        reason: args.reason,
        refType: args.refType ?? null,
        refId: args.refId ?? null,
        note: args.note ?? null,
        createdBy: args.createdBy,
      },
    });

    return { balance, movement };
  },
};

export class InsufficientStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientStockError";
  }
}
