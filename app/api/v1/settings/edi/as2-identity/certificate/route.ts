import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { fail } from "@/lib/api/respond";
import { as2Service } from "@/lib/services/as2-service";

/**
 * GET /api/v1/settings/edi/as2-identity/certificate — öffentliches AS2-
 * Zertifikat (PEM) als Datei-Download, zum Weitergeben an EDI-Partner.
 * Enthält nie den privaten Schlüssel.
 */
export const GET = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const identity = await as2Service.getIdentity(ctx.tenantId);
  if (!identity) return fail(404, "Not Found", "Noch keine AS2-Identität erzeugt");
  const filename = `${identity.as2Id.replace(/[^A-Za-z0-9._-]/g, "-")}_as2.pem`;
  return new NextResponse(identity.certificatePem, {
    status: 200,
    headers: {
      "Content-Type": "application/x-pem-file",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
