import { prisma } from "@/lib/db/client";
import type { Prisma, OrderStatus } from "@prisma/client";

type ListArgs = {
  tenantId: string;
  status?: OrderStatus;
  supplierId?: string;
  from?: string;
  to?: string;
  q?: string;
  page: number;
  pageSize: number;
};

export const orderRepo = {
  async list({ tenantId, status, supplierId, from, to, q, page, pageSize }: ListArgs) {
    const where: Prisma.OrderWhereInput = {
      tenantId,
      ...(status ? { status } : {}),
      ...(supplierId ? { supplierId } : {}),
      ...(from || to ? {
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      } : {}),
      ...(q ? {
        OR: [
          { orderNo: { contains: q, mode: "insensitive" } },
          { supplier: { name: { contains: q, mode: "insensitive" } } },
        ],
      } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize,
        include: {
          supplier: { select: { id: true, name: true, channel: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.count({ where }),
    ]);
    return { items, total };
  },

  async findById(tenantId: string, id: string) {
    return prisma.order.findFirst({
      where: { tenantId, id },
      include: {
        supplier: true,
        items: { include: { article: { select: { sku: true, name: true, orderUnit: true, baseUnit: true, packFactor: true, defaultLocationId: true } } } },
        events: { orderBy: { createdAt: "desc" } },
      },
    });
  },

  async findByIdMinimal(tenantId: string, id: string) {
    return prisma.order.findFirst({ where: { tenantId, id } });
  },
};
