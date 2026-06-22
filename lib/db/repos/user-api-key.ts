import { prisma } from "@/lib/db/client";
import type { UserRole } from "@/lib/auth/role";

export const userApiKeyRepo = {
  /** Active (non-revoked) keys of a user, newest first. */
  async listForUser(tenantId: string, userId: string) {
    return prisma.userApiKey.findMany({
      where: { tenantId, userId, revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
  },

  async create(data: {
    tenantId: string;
    userId: string;
    userEmail: string;
    label: string | null;
    prefix: string;
    hash: string;
    role: UserRole;
    expiresAt?: Date | null;
  }) {
    return prisma.userApiKey.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        userEmail: data.userEmail,
        label: data.label,
        prefix: data.prefix,
        hash: data.hash,
        role: data.role,
        expiresAt: data.expiresAt ?? null,
      },
    });
  },

  async findByPrefix(prefix: string) {
    return prisma.userApiKey.findUnique({ where: { prefix } });
  },

  /** Revoke a key (tenant- and user-scoped). Returns the batch count. */
  async revoke(tenantId: string, userId: string, id: string) {
    return prisma.userApiKey.updateMany({
      where: { id, tenantId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async touchLastUsed(id: string) {
    return prisma.userApiKey.update({ where: { id }, data: { lastUsedAt: new Date() } });
  },
};
