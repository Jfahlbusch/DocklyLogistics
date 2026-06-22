import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { webhookRepo } from "@/lib/db/repos/webhook";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const { id } = await params;
  const w = await webhookRepo.findById(ctx.tenantId, id);
  if (!w) return fail(404, "Not Found");
  const items = await prisma.webhookDelivery.findMany({
    where: { tenantId: ctx.tenantId, webhookId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return ok(
    items.map((d) => ({
      id: d.id,
      event: d.event,
      status: d.status,
      attempts: d.attempts,
      lastStatusCode: d.lastStatusCode,
      lastError: d.lastError,
      nextAttemptAt: d.nextAttemptAt,
      succeededAt: d.succeededAt,
      givenUpAt: d.givenUpAt,
      createdAt: d.createdAt,
    })),
  );
});
