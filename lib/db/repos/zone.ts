import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { ZoneCreate, ZoneUpdate } from "@/lib/schemas/zone";

const COUNTS = { _count: { select: { locations: true, articles: true } } } as const;

type ZoneWithCount = Prisma.ZoneGetPayload<{ include: typeof COUNTS }>;

function present({ _count, ...z }: ZoneWithCount) {
  return { ...z, locationCount: _count.locations, articleCount: _count.articles };
}

export const zoneRepo = {
  async list(tenantId: string, opts: { q?: string; limit?: number } = {}) {
    const rows = await prisma.zone.findMany({
      where: {
        tenantId,
        ...(opts.q ? { name: { contains: opts.q, mode: "insensitive" } } : {}),
      },
      include: COUNTS,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      ...(opts.limit ? { take: opts.limit } : {}),
    });
    return rows.map(present);
  },

  async findById(tenantId: string, id: string) {
    const z = await prisma.zone.findFirst({ where: { tenantId, id }, include: COUNTS });
    return z ? present(z) : null;
  },

  async findByName(tenantId: string, name: string) {
    return prisma.zone.findFirst({ where: { tenantId, name } });
  },

  /** true, wenn die Zone existiert und zum Mandanten gehört. */
  async existsInTenant(tenantId: string, id: string) {
    return (await prisma.zone.count({ where: { tenantId, id } })) > 0;
  },

  async create(tx: Prisma.TransactionClient, tenantId: string, input: ZoneCreate) {
    return tx.zone.create({
      data: { tenantId, name: input.name, ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}), ...(input.active !== undefined ? { active: input.active } : {}) },
    });
  },

  async update(tx: Prisma.TransactionClient, tenantId: string, id: string, input: ZoneUpdate) {
    const res = await tx.zone.updateMany({
      where: { tenantId, id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
    if (res.count === 0) return null;
    return tx.zone.findFirst({ where: { tenantId, id } });
  },

  async remove(tx: Prisma.TransactionClient, tenantId: string, id: string) {
    return tx.zone.deleteMany({ where: { tenantId, id } });
  },
};
