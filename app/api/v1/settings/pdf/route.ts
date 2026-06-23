import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok } from "@/lib/api/respond";
import { tenantPdfSettingsRepo } from "@/lib/db/repos/tenant-pdf-settings";
import { PdfSettingsSchema } from "@/lib/schemas/pdf-settings";

const norm = (v: string | null | undefined) => (v && v.length > 0 ? v : null);

/** GET /api/v1/settings/pdf — current order-slip branding for the tenant. */
export const GET = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  return ok(await tenantPdfSettingsRepo.get(ctx.tenantId));
});

/** PUT /api/v1/settings/pdf — save logo / header / footer (MANAGER+). */
export const PUT = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const body = PdfSettingsSchema.parse(await req.json());
  await tenantPdfSettingsRepo.upsert(ctx.tenantId, {
    logoDataUri: norm(body.logoDataUri),
    headerText: norm(body.headerText),
    footerText: norm(body.footerText),
  });
  return ok(await tenantPdfSettingsRepo.get(ctx.tenantId));
});
