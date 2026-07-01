import crypto from "node:crypto";
import { prisma } from "@/lib/db/client";

/** Inbound token: "edi_" + 40 hex chars — the tenant's EDI mailbox address. */
function generateInboundToken(): string {
  return `edi_${crypto.randomBytes(20).toString("hex")}`;
}

export const tenantEdiSettingsRepo = {
  /** Get-or-create — every tenant gets a mailbox token on first touch. */
  async ensure(tenantId: string) {
    const existing = await prisma.tenantEdiSettings.findUnique({ where: { tenantId } });
    if (existing) return existing;
    return prisma.tenantEdiSettings.create({
      data: { tenantId, inboundToken: generateInboundToken() },
    });
  },

  get(tenantId: string) {
    return prisma.tenantEdiSettings.findUnique({ where: { tenantId } });
  },

  findByToken(token: string) {
    return prisma.tenantEdiSettings.findUnique({ where: { inboundToken: token } });
  },

  update(tenantId: string, data: { inboundActive?: boolean; autoConfirm?: boolean }) {
    return prisma.tenantEdiSettings.update({ where: { tenantId }, data });
  },

  async rotateToken(tenantId: string) {
    await this.ensure(tenantId);
    return prisma.tenantEdiSettings.update({
      where: { tenantId },
      data: { inboundToken: generateInboundToken() },
    });
  },
};
