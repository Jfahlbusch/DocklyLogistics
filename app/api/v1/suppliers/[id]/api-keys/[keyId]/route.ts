import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { apiKeyRepo } from "@/lib/db/repos/api-key";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { noContent, fail } from "@/lib/api/respond";

type Ctx = { params: Promise<{ id: string; keyId: string }> };

export const DELETE = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = requireRoleFromHeaders(req.headers, "MANAGER");
  const { id, keyId } = await params;
  const existing = await apiKeyRepo.findById(ctx.tenantId, keyId);
  if (!existing || existing.supplierId !== id) return fail(404, "Not Found");
  if (existing.revokedAt) return fail(409, "Already revoked");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  await prisma.$transaction(async (tx) => {
    await apiKeyRepo.revoke(tx, keyId);
    await appendAudit(tx, {
      tenantId: ctx.tenantId, entity: "SupplierApiKey", entityId: keyId, action: "DELETE",
      actorId, actorEmail,
      before: { prefix: existing.prefix }, after: { revokedAt: new Date().toISOString() },
    });
  });

  return noContent();
});
