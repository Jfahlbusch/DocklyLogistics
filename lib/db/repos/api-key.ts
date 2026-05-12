import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";

export const apiKeyRepo = {
  async list(tenantId: string, supplierId: string) {
    return prisma.supplierApiKey.findMany({
      where: { tenantId, supplierId },
      orderBy: { createdAt: "desc" },
    });
  },

  async findById(tenantId: string, id: string) {
    return prisma.supplierApiKey.findFirst({ where: { tenantId, id } });
  },

  async findByPrefix(prefix: string) {
    // Cross-tenant lookup — caller validates tenant via supplier afterwards
    return prisma.supplierApiKey.findUnique({
      where: { prefix },
      include: { supplier: { select: { id: true, tenantId: true, channel: true, active: true } } },
    });
  },

  async create(tx: Prisma.TransactionClient, data: {
    tenantId: string;
    supplierId: string;
    label?: string | null;
    prefix: string;
    hash: string;
    scopes: string[];
    expiresAt?: Date | null;
    createdBy: string;
  }) {
    return tx.supplierApiKey.create({
      data: {
        tenantId: data.tenantId,
        supplierId: data.supplierId,
        label: data.label ?? null,
        prefix: data.prefix,
        hash: data.hash,
        scopes: data.scopes,
        expiresAt: data.expiresAt ?? null,
        createdBy: data.createdBy,
      },
    });
  },

  async revoke(tx: Prisma.TransactionClient, id: string) {
    return tx.supplierApiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  },

  async touchLastUsed(id: string) {
    return prisma.supplierApiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  },
};
