import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { webhookRepo } from "@/lib/db/repos/webhook";
import { encryptSecret, generateWebhookSecret } from "@/lib/crypto/aes";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, created } from "@/lib/api/respond";
import { WebhookCreateSchema } from "@/lib/schemas/webhook";

export const GET = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const items = await webhookRepo.list(ctx.tenantId);
  return ok(
    items.map((w) => ({
      id: w.id,
      url: w.url,
      events: w.events,
      active: w.active,
      description: w.description,
      lastDeliveredAt: w.lastDeliveredAt,
      createdAt: w.createdAt,
      createdBy: w.createdBy,
    })),
  );
});

export const POST = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const body = WebhookCreateSchema.parse(await req.json());

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const secret = generateWebhookSecret();
  const secretEncrypted = encryptSecret(secret);

  const saved = await prisma.$transaction(async (tx) => {
    const w = await webhookRepo.create(tx, {
      tenantId: ctx.tenantId,
      url: body.url,
      events: body.events,
      description: body.description ?? null,
      active: body.active,
      secretEncrypted,
      createdBy: actorEmail,
    });
    await appendAudit(tx, {
      tenantId: ctx.tenantId,
      entity: "Webhook",
      entityId: w.id,
      action: "CREATE",
      actorId,
      actorEmail,
      after: { url: w.url, events: w.events, active: w.active },
    });
    return w;
  });

  return created({
    id: saved.id,
    url: saved.url,
    events: saved.events,
    active: saved.active,
    description: saved.description,
    createdAt: saved.createdAt,
    secret,
    warning: "Speichere das Secret jetzt — es wird nie wieder angezeigt.",
  });
});
