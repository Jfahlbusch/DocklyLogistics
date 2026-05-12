import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { publicHandler } from "@/lib/api/public-handler";
import { authenticatePublic, PublicAuthError } from "@/lib/api/public-auth";
import { ok } from "@/lib/api/respond";
import { PublicWebhookInboundSchema } from "@/lib/schemas/public-api";

type Ctx = { params: Promise<{ supplierId: string }> };

export const POST = publicHandler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await authenticatePublic(req.headers, "deliveries:write");
  const { supplierId } = await params;
  if (supplierId !== ctx.supplierId) {
    throw new PublicAuthError(
      403,
      "Forbidden",
      "Pfad-Lieferant stimmt nicht mit API-Key-Lieferant überein",
    );
  }
  const body = PublicWebhookInboundSchema.parse(await req.json());

  // Store the inbound event as an AuditLog entry (a proper inbound queue
  // arrives in M5+). This is not part of a business transaction, so writing
  // directly to prisma.auditLog.create is acceptable.
  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      entity: "InboundWebhook",
      entityId: ctx.supplierId,
      action: "CREATE",
      actorId: `apikey:${ctx.apiKeyId}`,
      actorEmail: `api:${ctx.prefix}`,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
      after: {
        event: body.event,
        data: body.data as Prisma.InputJsonValue,
        supplierName: ctx.supplierName,
      },
    },
  });

  return ok({ accepted: true, event: body.event }, undefined, { status: 202 });
});
