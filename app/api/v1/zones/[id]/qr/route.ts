import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { zoneRepo } from "@/lib/db/repos/zone";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { fail } from "@/lib/api/respond";
import { generateBarcode } from "@/lib/barcode/generate";
import { appBaseUrl, zoneWalkUrl } from "@/lib/warehouse/zone-walk-url";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const { id } = await params;
  const zone = await zoneRepo.findById(ctx.tenantId, id);
  if (!zone) return fail(404, "Not Found");

  // Wirft bei fehlender Konfiguration → handler loggt und antwortet 500.
  const url = zoneWalkUrl(appBaseUrl(), zone.id);
  const { svg } = await generateBarcode({ format: "qrcode", source: "SKU", sku: url });
  return new NextResponse(svg, {
    status: 200,
    headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "private, max-age=300" },
  });
});
