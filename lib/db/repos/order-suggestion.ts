import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";

type ListArgs = {
  tenantId: string;
  status?: "PENDING" | "CONFIRMED" | "DISMISSED";
  articleId?: string;
  page: number;
  pageSize: number;
};

export const orderSuggestionRepo = {
  async list({ tenantId, status, articleId, page, pageSize }: ListArgs) {
    const where: Prisma.OrderSuggestionWhereInput = {
      tenantId,
      ...(status ? { status } : {}),
      ...(articleId ? { articleId } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.orderSuggestion.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          article: {
            select: { sku: true, name: true, minStock: true, orderUnit: true, packFactor: true },
          },
          supplier: { select: { id: true, name: true, channel: true } },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      }),
      prisma.orderSuggestion.count({ where }),
    ]);
    return { items, total };
  },

  async findById(tenantId: string, id: string) {
    return prisma.orderSuggestion.findFirst({ where: { tenantId, id } });
  },

  async createManual(
    tx: Prisma.TransactionClient,
    tenantId: string,
    input: {
      articleId: string;
      supplierId?: string | null;
      qtyOrderUnit: number;
      note?: string | null;
      createdBy: string;
    },
  ) {
    return tx.orderSuggestion.create({
      data: {
        tenantId,
        articleId: input.articleId,
        supplierId: input.supplierId ?? null,
        qtyOrderUnit: input.qtyOrderUnit,
        reason: "MANUAL_SCAN",
        status: "PENDING",
        note: input.note ?? null,
        createdBy: input.createdBy,
      },
    });
  },

  async update(
    tx: Prisma.TransactionClient,
    id: string,
    patch: { supplierId?: string | null; qtyOrderUnit?: number; note?: string | null },
  ) {
    return tx.orderSuggestion.update({
      where: { id },
      data: {
        ...(patch.supplierId !== undefined ? { supplierId: patch.supplierId ?? null } : {}),
        ...(patch.qtyOrderUnit !== undefined ? { qtyOrderUnit: patch.qtyOrderUnit } : {}),
        ...(patch.note !== undefined ? { note: patch.note ?? null } : {}),
      },
    });
  },

  async setStatus(
    tx: Prisma.TransactionClient,
    id: string,
    status: "CONFIRMED" | "DISMISSED",
  ) {
    return tx.orderSuggestion.update({ where: { id }, data: { status } });
  },
};
