import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { SupplierCreate, SupplierUpdate } from "@/lib/schemas/supplier";

type ListArgs = {
  tenantId: string;
  q?: string;
  channel?: "EMAIL" | "API" | "EDI";
  active?: boolean;
  page: number;
  pageSize: number;
};

export const supplierRepo = {
  async list({ tenantId, q, channel, active, page, pageSize }: ListArgs) {
    const where: Prisma.SupplierWhereInput = {
      tenantId,
      ...(channel ? { channel } : {}),
      ...(active !== undefined ? { active } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { contactName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.supplier.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { name: "asc" } }),
      prisma.supplier.count({ where }),
    ]);
    return { items, total };
  },

  async findById(tenantId: string, id: string) {
    return prisma.supplier.findFirst({ where: { tenantId, id } });
  },

  async findByName(tenantId: string, name: string) {
    return prisma.supplier.findFirst({ where: { tenantId, name } });
  },

  async create(tx: Prisma.TransactionClient, tenantId: string, input: SupplierCreate) {
    return tx.supplier.create({
      data: {
        tenantId,
        name: input.name,
        contactName: input.contactName,
        email: input.email,
        phone: input.phone,
        street: input.street,
        city: input.city,
        postalCode: input.postalCode,
        country: input.country,
        channel: input.channel,
        channelConfig: (input.channelConfig ?? {}) as Prisma.InputJsonValue,
        active: input.active,
      },
    });
  },

  async update(tx: Prisma.TransactionClient, _tenantId: string, id: string, input: SupplierUpdate) {
    return tx.supplier.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.contactName !== undefined ? { contactName: input.contactName } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.street !== undefined ? { street: input.street } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.channel !== undefined ? { channel: input.channel } : {}),
        ...(input.channelConfig !== undefined ? { channelConfig: input.channelConfig as Prisma.InputJsonValue } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
  },

  async remove(tx: Prisma.TransactionClient, id: string) {
    return tx.supplier.delete({ where: { id } });
  },
};
