import type { NextRequest } from "next/server";
import { orderRepo } from "@/lib/db/repos/order";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = requireRoleFromHeaders(req.headers, "VIEWER");
  const { id } = await params;
  const order = await orderRepo.findById(ctx.tenantId, id);
  if (!order) return fail(404, "Not Found");
  return ok(order.events);
});
