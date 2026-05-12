import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { webhookRepo } from "@/lib/db/repos/webhook";
import { encryptSecret, generateWebhookSecret } from "@/lib/crypto/aes";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;
  const existing = await webhookRepo.findById(ctx.tenantId, id);
  if (!existing) return fail(404, "Not Found");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const secret = generateWebhookSecret();
  const secretEncrypted = encryptSecret(secret);

  await prisma.$transaction(async (tx) => {
    await tx.webhook.update({ where: { id }, data: { secretEncrypted } });
    await appendAudit(tx, {
      tenantId: ctx.tenantId,
      entity: "Webhook",
      entityId: id,
      action: "UPDATE",
      actorId,
      actorEmail,
      after: { secretRotated: true },
    });
  });

  return ok({
    secret,
    warning: "Speichere das neue Secret jetzt — es wird nie wieder angezeigt.",
  });
});
