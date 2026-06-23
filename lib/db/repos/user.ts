import { prisma } from "@/lib/db/client";

/** Tenant users for the Benutzer overview / permission management. */
export const userRepo = {
  async listForTenant(tenantId: string) {
    return prisma.user.findMany({
      where: { tenantId },
      select: { id: true, email: true, name: true, role: true, lastLoginAt: true, createdAt: true },
      orderBy: [{ role: "asc" }, { email: "asc" }],
    });
  },

  async findInTenant(tenantId: string, id: string) {
    return prisma.user.findFirst({
      where: { tenantId, id },
      select: { id: true, email: true, name: true, role: true },
    });
  },
};
