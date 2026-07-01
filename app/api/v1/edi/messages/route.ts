import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok } from "@/lib/api/respond";
import { ediMessageRepo } from "@/lib/db/repos/edi-message";
import { EdiMessageListQuerySchema } from "@/lib/schemas/edi";

/** GET /api/v1/edi/messages — the EDI monitor list (without payloads). */
export const GET = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "USER");
  const q = EdiMessageListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const { rows, total, page, pageSize } = await ediMessageRepo.list(ctx.tenantId, q);
  return ok(rows, { page, pageSize, total });
});
