import { prisma } from "@/lib/db/client";

export type PdfSettings = {
  logoDataUri: string | null;
  headerText: string | null;
  footerText: string | null;
};

const EMPTY: PdfSettings = { logoDataUri: null, headerText: null, footerText: null };

export const tenantPdfSettingsRepo = {
  /** Branding for a tenant's order-slip PDF. Returns empty defaults if none set. */
  async get(tenantId: string): Promise<PdfSettings> {
    const row = await prisma.tenantPdfSettings.findUnique({ where: { tenantId } });
    if (!row) return { ...EMPTY };
    return {
      logoDataUri: row.logoDataUri ?? null,
      headerText: row.headerText ?? null,
      footerText: row.footerText ?? null,
    };
  },

  async upsert(tenantId: string, data: PdfSettings) {
    const value = {
      logoDataUri: data.logoDataUri,
      headerText: data.headerText,
      footerText: data.footerText,
    };
    return prisma.tenantPdfSettings.upsert({
      where: { tenantId },
      update: value,
      create: { tenantId, ...value },
    });
  },
};
