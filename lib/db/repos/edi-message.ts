import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";

export type EdiMessageCreate = {
  tenantId: string;
  direction: "IN" | "OUT";
  type: string;
  status: string;
  transport?: string | null;
  supplierId?: string | null;
  orderId?: string | null;
  interchangeRef?: string | null;
  documentNo?: string | null;
  payload: string;
  parsed?: Prisma.InputJsonValue;
  error?: string | null;
  createdBy: string;
};

export type EdiMessageListFilter = {
  direction?: "IN" | "OUT";
  status?: string;
  type?: string;
  page?: number;
  pageSize?: number;
};

export const ediMessageRepo = {
  create(data: EdiMessageCreate) {
    return prisma.ediMessage.create({ data });
  },

  async list(tenantId: string, f: EdiMessageListFilter = {}) {
    const page = Math.max(1, f.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, f.pageSize ?? 25));
    const where: Prisma.EdiMessageWhereInput = {
      tenantId,
      ...(f.direction ? { direction: f.direction } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.type ? { type: f.type } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.ediMessage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        // list view: skip the big payload text; the detail endpoint returns it
        omit: { payload: true },
      }),
      prisma.ediMessage.count({ where }),
    ]);

    // enrich with supplier names for the monitor
    const supplierIds = [...new Set(rows.map((r) => r.supplierId).filter((v): v is string => !!v))];
    const suppliers = supplierIds.length
      ? await prisma.supplier.findMany({
          where: { tenantId, id: { in: supplierIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(suppliers.map((s) => [s.id, s.name]));
    const enriched = rows.map((r) => ({
      ...r,
      supplierName: r.supplierId ? (nameById.get(r.supplierId) ?? null) : null,
    }));

    return { rows: enriched, total, page, pageSize };
  },

  findInTenant(tenantId: string, id: string) {
    return prisma.ediMessage.findFirst({ where: { tenantId, id } });
  },

  update(
    id: string,
    data: Partial<Pick<EdiMessageCreate, "status" | "orderId" | "supplierId" | "error" | "documentNo">> & {
      parsed?: Prisma.InputJsonValue;
    },
  ) {
    return prisma.ediMessage.update({ where: { id }, data });
  },
};
