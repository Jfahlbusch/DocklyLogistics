import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { ArticleCreate, ArticleUpdate } from "@/lib/schemas/article";

type ListArgs = {
  tenantId: string;
  q?: string;
  category?: string;
  supplierId?: string;
  belowMin?: boolean;
  page: number;
  pageSize: number;
};

export const articleRepo = {
  async list({ tenantId, q, category, supplierId, belowMin, page, pageSize }: ListArgs) {
    const where: Prisma.ArticleWhereInput = {
      tenantId,
      ...(category ? { category } : {}),
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

    const [items, total] = await Promise.all([
      prisma.article.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.article.count({ where }),
    ]);

    // belowMin filter requires aggregated stock data which doesn't exist yet (M3).
    // For M2: filter on minStock > 0 as a placeholder, ignoring actual stock.
    // This will be replaced in M3 with a proper join on StockBalance.
    const filtered = belowMin ? items.filter((a) => a.minStock > 0) : items;

    return { items: filtered, total };
  },

  async findById(tenantId: string, id: string) {
    return prisma.article.findFirst({ where: { tenantId, id } });
  },

  async findBySku(tenantId: string, sku: string) {
    return prisma.article.findFirst({ where: { tenantId, sku } });
  },

  async create(tx: Prisma.TransactionClient, tenantId: string, input: ArticleCreate) {
    return tx.article.create({
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
        defaultLocationId: input.defaultLocationId,
        vatRate: input.vatRate,
      },
    });
  },

  async update(tx: Prisma.TransactionClient, tenantId: string, id: string, input: ArticleUpdate) {
    return tx.article.update({
      where: { id },
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
        ...(input.defaultLocationId !== undefined ? { defaultLocationId: input.defaultLocationId } : {}),
        ...(input.vatRate !== undefined ? { vatRate: input.vatRate } : {}),
      },
    });
  },

  async remove(tx: Prisma.TransactionClient, id: string) {
    return tx.article.delete({ where: { id } });
  },
};
