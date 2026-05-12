import { prisma } from "@/lib/db/client";
import type { Prisma, SupplierChannel } from "@prisma/client";
import type { TenantChannelConfigCreate, TenantChannelConfigUpdate } from "@/lib/schemas/tenant-channel";

type ListArgs = {
  tenantId: string;
  channel?: SupplierChannel;
  active?: boolean;
  page: number;
  pageSize: number;
};

export const tenantChannelRepo = {
  async list({ tenantId, channel, active, page, pageSize }: ListArgs) {
    const where: Prisma.TenantChannelConfigWhereInput = {
      tenantId,
      ...(channel ? { channel } : {}),
      ...(active !== undefined ? { active } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.tenantChannelConfig.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize,
        orderBy: [{ channel: "asc" }, { isDefault: "desc" }, { label: "asc" }],
      }),
      prisma.tenantChannelConfig.count({ where }),
    ]);
    return { items, total };
  },

  async findById(tenantId: string, id: string) {
    return prisma.tenantChannelConfig.findFirst({ where: { tenantId, id } });
  },

  async findDefault(tenantId: string, channel: SupplierChannel) {
    return prisma.tenantChannelConfig.findFirst({
      where: { tenantId, channel, isDefault: true, active: true },
    });
  },

  /**
   * Creates a TenantChannelConfig. When isDefault=true, clears the default
   * flag from any sibling entry of the same (tenantId, channel) FIRST to
   * honour the partial-unique-index.
   */
  async create(tx: Prisma.TransactionClient, tenantId: string, input: TenantChannelConfigCreate) {
    if (input.isDefault) {
      await tx.tenantChannelConfig.updateMany({
        where: { tenantId, channel: input.channel, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.tenantChannelConfig.create({
      data: {
        tenantId,
        channel: input.channel,
        active: input.active,
        isDefault: input.isDefault,
        label: input.label ?? null,
        config: (input.config ?? {}) as Prisma.InputJsonValue,
      },
    });
  },

  async update(tx: Prisma.TransactionClient, tenantId: string, id: string, input: TenantChannelConfigUpdate) {
    if (input.isDefault === true) {
      const existing = await tx.tenantChannelConfig.findFirst({ where: { tenantId, id }, select: { channel: true } });
      if (existing) {
        await tx.tenantChannelConfig.updateMany({
          where: { tenantId, channel: existing.channel, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }
    }
    return tx.tenantChannelConfig.update({
      where: { id },
      data: {
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.config !== undefined ? { config: input.config as Prisma.InputJsonValue } : {}),
      },
    });
  },

  async remove(tx: Prisma.TransactionClient, id: string) {
    return tx.tenantChannelConfig.delete({ where: { id } });
  },
};
