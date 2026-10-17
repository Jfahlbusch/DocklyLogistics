import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { ArticleCreate, ArticleUpdate } from "@/lib/schemas/article";
import { stockRepo } from "./stock";

const WITH_ZONE = { zone: { select: { id: true, name: true } } } satisfies Prisma.ArticleInclude;

type ListArgs = {
  tenantId: string;
  q?: string;
  category?: string;
  supplierId?: string;
  zoneId?: string;
  belowMin?: boolean;
  page: number;
  pageSize: number;
};

export const articleRepo = {
  async list({ tenantId, q, category, supplierId, zoneId, belowMin, page, pageSize }: ListArgs) {
    const where: Prisma.ArticleWhereInput = {
      tenantId,
      ...(category ? { category } : {}),
      ...(zoneId ? { zoneId } : {}),
      ...(supplierId
        ? { suppliers: { some: { supplierId } } }
        : {}),
      ...(q
        ? {
            OR: [
              { sku: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { eanGtin: { contains: q } },
            ],
          }
        : {}),
    };

    if (belowMin) {
      // "Below minimum" = total stock across all locations < minStock (minStock > 0).
      // Aggregate over the filtered candidate set, then paginate the actual matches —
      // count and page both reflect the real shortfall, not just "has a minStock".
      const candidates = await prisma.article.findMany({
        where: { ...where, minStock: { gt: 0 } },
        select: { id: true, minStock: true },
        orderBy: { name: "asc" },
      });
      const totals = await stockRepo.totalsByArticle(
        tenantId,
        candidates.map((c) => c.id),
      );
      const belowIds = candidates
        .filter((c) => (totals.get(c.id) ?? 0) < c.minStock)
        .map((c) => c.id);

      const items = await prisma.article.findMany({
        where: { tenantId, id: { in: belowIds } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: "asc" },
        include: WITH_ZONE,
      });
      return { items, total: belowIds.length };
    }

    const [items, total] = await Promise.all([
      prisma.article.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: "asc" },
        include: WITH_ZONE,
      }),
      prisma.article.count({ where }),
    ]);

    return { items, total };
  },

  async findById(tenantId: string, id: string) {
    return prisma.article.findFirst({ where: { tenantId, id }, include: WITH_ZONE });
  },

  async findBySku(tenantId: string, sku: string) {
    return prisma.article.findFirst({ where: { tenantId, sku } });
  },

  async create(tx: Prisma.TransactionClient, tenantId: string, input: ArticleCreate) {
    return tx.article.create({
      include: WITH_ZONE,
      data: {
        tenantId,
        sku: input.sku,
        name: input.name,
        shortDesc: input.shortDesc,
        longDesc: input.longDesc,
        category: input.category,
        eanGtin: input.eanGtin,
        baseUnit: input.baseUnit,
        orderUnit: input.orderUnit,
        packFactor: input.packFactor,
        barcodeSource: input.barcodeSource,
        minStock: input.minStock,
        maxStock: input.maxStock,
        targetStock: input.targetStock,
        defaultLocationId: input.defaultLocationId,
        zoneId: input.zoneId,
        vatRate: input.vatRate,
      },
    });
  },

  async update(tx: Prisma.TransactionClient, tenantId: string, id: string, input: ArticleUpdate) {
    return tx.article.update({
      where: { id },
      include: WITH_ZONE,
      data: {
        ...(input.sku !== undefined ? { sku: input.sku } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.shortDesc !== undefined ? { shortDesc: input.shortDesc } : {}),
        ...(input.longDesc !== undefined ? { longDesc: input.longDesc } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.eanGtin !== undefined ? { eanGtin: input.eanGtin } : {}),
        ...(input.baseUnit !== undefined ? { baseUnit: input.baseUnit } : {}),
        ...(input.orderUnit !== undefined ? { orderUnit: input.orderUnit } : {}),
        ...(input.packFactor !== undefined ? { packFactor: input.packFactor } : {}),
        ...(input.barcodeSource !== undefined ? { barcodeSource: input.barcodeSource } : {}),
        ...(input.minStock !== undefined ? { minStock: input.minStock } : {}),
        ...(input.maxStock !== undefined ? { maxStock: input.maxStock } : {}),
        ...(input.targetStock !== undefined ? { targetStock: input.targetStock } : {}),
        ...(input.defaultLocationId !== undefined ? { defaultLocationId: input.defaultLocationId } : {}),
        ...(input.zoneId !== undefined ? { zoneId: input.zoneId } : {}),
        ...(input.vatRate !== undefined ? { vatRate: input.vatRate } : {}),
      },
    });
  },

  async remove(tx: Prisma.TransactionClient, id: string) {
    return tx.article.delete({ where: { id } });
  },
};
