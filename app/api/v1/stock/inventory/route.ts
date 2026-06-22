import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { postInventory } from "@/lib/services/inventory";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";

const InventorySchema = z.object({
  locationId: z.string().cuid(),
  counts: z
    .array(z.object({ articleId: z.string().cuid(), countedQty: z.number().int().min(0) }))
    .min(1),
});

/**
 * POST /api/v1/stock/inventory — book a stocktake for a location: adjust each
 * counted article's balance to the counted quantity via INVENTORY movements.
 */
export const POST = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "USER");
  const body = InventorySchema.parse(await req.json());

  const location = await prisma.storageLocation.findFirst({
    where: { tenantId: ctx.tenantId, id: body.locationId },
  });
  if (!location) return fail(404, "Lagerplatz nicht gefunden");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const adjustments = await prisma.$transaction(async (tx) => {
    const adj = await postInventory(tx, {
      tenantId: ctx.tenantId,
      locationId: body.locationId,
      counts: body.counts,
      createdBy: actorId,
    });
    if (adj.length > 0) {
      await appendAudit(tx, {
        tenantId: ctx.tenantId,
        entity: "Inventory",
        entityId: body.locationId,
        action: "UPDATE",
        actorId,
        actorEmail,
        after: {
          locationId: body.locationId,
          adjustments: adj.length,
          deltas: adj.map((a) => ({ articleId: a.articleId, delta: a.delta })),
        },
      });
    }
    return adj;
  });

  return ok({ locationId: body.locationId, adjusted: adjustments.length, adjustments });
});
