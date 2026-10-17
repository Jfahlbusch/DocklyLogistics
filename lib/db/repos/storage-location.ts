import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { StorageLocationCreate, StorageLocationUpdate } from "@/lib/schemas/storage-location";

const WITH_ZONE = { zoneRef: { select: { name: true } } } satisfies Prisma.StorageLocationInclude;

/** Antwortform: `zone` = Name der verknüpften Zone (Fallback: alter Freitext), `zoneRef` nicht nach außen. */
function present<T extends { zone: string | null; zoneRef: { name: string } | null }>({ zoneRef, ...l }: T) {
  return { ...l, zone: zoneRef?.name ?? l.zone };
}

type ListArgs = {
  tenantId: string;
  q?: string;
  zone?: string;
  active?: boolean;
  page: number;
  pageSize: number;
};

export const storageLocationRepo = {
  async list({ tenantId, q, zone, active, page, pageSize }: ListArgs) {
    const where: Prisma.StorageLocationWhereInput = {
      tenantId,
      ...(zone ? { OR: [{ zoneRef: { name: zone } }, { zoneId: null, zone }] } : {}),
      ...(active !== undefined ? { active } : {}),
      ...(q
        ? {
            AND: [{ OR: [
              { code: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { zone: { contains: q, mode: "insensitive" } },
              { zoneRef: { name: { contains: q, mode: "insensitive" } } },
              { bin: { contains: q, mode: "insensitive" } },
            ] }],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.storageLocation.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { code: "asc" },
        include: WITH_ZONE,
      }),
      prisma.storageLocation.count({ where }),
    ]);
    return { items: items.map(present), total };
  },

  async findById(tenantId: string, id: string) {
    const l = await prisma.storageLocation.findFirst({ where: { tenantId, id }, include: WITH_ZONE });
    return l ? present(l) : null;
  },

  async findByCode(tenantId: string, code: string) {
    return prisma.storageLocation.findFirst({ where: { tenantId, code } });
  },

  async create(tx: Prisma.TransactionClient, tenantId: string, input: StorageLocationCreate) {
    const l = await tx.storageLocation.create({
      data: {
        tenantId,
        code: input.code,
        name: input.name,
        zoneId: input.zoneId ?? null,
        bin: input.bin,
        capacity: input.capacity,
        active: input.active,
      },
      include: WITH_ZONE,
    });
    return present(l);
  },

  async update(tx: Prisma.TransactionClient, _tenantId: string, id: string, input: StorageLocationUpdate) {
    const l = await tx.storageLocation.update({
      where: { id },
      data: {
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.zoneId !== undefined ? { zoneId: input.zoneId } : {}),
        ...(input.bin !== undefined ? { bin: input.bin } : {}),
        ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
      include: WITH_ZONE,
    });
    return present(l);
  },

  async remove(tx: Prisma.TransactionClient, id: string) {
    return tx.storageLocation.delete({ where: { id } });
  },
};
