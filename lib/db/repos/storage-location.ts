import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { StorageLocationCreate, StorageLocationUpdate } from "@/lib/schemas/storage-location";

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
      ...(zone ? { zone } : {}),
      ...(active !== undefined ? { active } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { zone: { contains: q, mode: "insensitive" } },
              { bin: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.storageLocation.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { code: "asc" },
      }),
      prisma.storageLocation.count({ where }),
    ]);
    return { items, total };
  },

  async findById(tenantId: string, id: string) {
    return prisma.storageLocation.findFirst({ where: { tenantId, id } });
  },

  async findByCode(tenantId: string, code: string) {
    return prisma.storageLocation.findFirst({ where: { tenantId, code } });
  },

  async create(tx: Prisma.TransactionClient, tenantId: string, input: StorageLocationCreate) {
    return tx.storageLocation.create({
      data: {
        tenantId,
        code: input.code,
        name: input.name,
        zone: input.zone,
        bin: input.bin,
        capacity: input.capacity,
        active: input.active,
      },
    });
  },

  async update(tx: Prisma.TransactionClient, _tenantId: string, id: string, input: StorageLocationUpdate) {
    return tx.storageLocation.update({
      where: { id },
      data: {
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.zone !== undefined ? { zone: input.zone } : {}),
        ...(input.bin !== undefined ? { bin: input.bin } : {}),
        ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
  },

  async remove(tx: Prisma.TransactionClient, id: string) {
    return tx.storageLocation.delete({ where: { id } });
  },
};
