import type { NextRequest } from "next/server";
import { z } from "zod";
import { articleRepo } from "@/lib/db/repos/article";
import { generateBarcode } from "@/lib/barcode/generate";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";

const BarcodeRequestSchema = z.object({
  format: z.enum(["code128", "ean13"]),
  source: z.enum(["SKU", "EAN"]).default("SKU"),
});

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = requireRoleFromHeaders(req.headers, "VIEWER");
  const { id } = await params;
  const article = await articleRepo.findById(ctx.tenantId, id);
  if (!article) return fail(404, "Article not found");

  const body = BarcodeRequestSchema.parse(await req.json());
  try {
    const result = await generateBarcode({
      format: body.format,
      source: body.source,
      sku: article.sku,
      eanGtin: article.eanGtin,
    });
    return ok(result);
  } catch (err) {
    return fail(422, "Barcode generation failed", (err as Error).message);
  }
});
