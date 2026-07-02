import crypto from "node:crypto";
import { prisma } from "@/lib/db/client";

/** Partner mailbox token: "edi_p_" + 40 hex — distinguishable from the tenant token. */
function generatePartnerToken(): string {
  return `edi_p_${crypto.randomBytes(20).toString("hex")}`;
}

export const ediPartnerMailboxRepo = {
  async list(tenantId: string) {
    const rows = await prisma.ediPartnerMailbox.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });
    const supplierIds = [...new Set(rows.map((r) => r.supplierId).filter((v): v is string => !!v))];
    const suppliers = supplierIds.length
      ? await prisma.supplier.findMany({
          where: { tenantId, id: { in: supplierIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(suppliers.map((s) => [s.id, s.name]));
    return rows.map((r) => ({
      ...r,
      supplierName: r.supplierId ? (nameById.get(r.supplierId) ?? null) : null,
    }));
  },

  findInTenant(tenantId: string, id: string) {
    return prisma.ediPartnerMailbox.findFirst({ where: { tenantId, id } });
  },

  findByToken(token: string) {
    return prisma.ediPartnerMailbox.findUnique({ where: { token } });
  },

  create(tenantId: string, data: { name: string; partnerGln?: string | null; supplierId?: string | null }) {
    return prisma.ediPartnerMailbox.create({
      data: {
        tenantId,
        name: data.name,
        partnerGln: data.partnerGln ?? null,
        supplierId: data.supplierId ?? null,
        token: generatePartnerToken(),
      },
    });
  },

  async update(
    tenantId: string,
    id: string,
    data: { name?: string; partnerGln?: string | null; supplierId?: string | null; active?: boolean },
  ) {
    const existing = await this.findInTenant(tenantId, id);
    if (!existing) return null;
    return prisma.ediPartnerMailbox.update({ where: { id }, data });
  },

  async rotateToken(tenantId: string, id: string) {
    const existing = await this.findInTenant(tenantId, id);
    if (!existing) return null;
    return prisma.ediPartnerMailbox.update({
      where: { id },
      data: { token: generatePartnerToken() },
    });
  },

  async remove(tenantId: string, id: string) {
    const existing = await this.findInTenant(tenantId, id);
    if (!existing) return false;
    await prisma.ediPartnerMailbox.delete({ where: { id } });
    return true;
  },

  /** Fire-and-forget usage stamp (mirrors userApiKeyRepo.touchLastUsed). */
  touchLastUsed(id: string) {
    return prisma.ediPartnerMailbox.update({ where: { id }, data: { lastUsedAt: new Date() } });
  },
};
