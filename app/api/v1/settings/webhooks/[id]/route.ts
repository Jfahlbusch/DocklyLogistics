import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { webhookRepo } from "@/lib/db/repos/webhook";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, noContent, fail } from "@/lib/api/respond";
import { WebhookUpdateSchema } from "@/lib/schemas/webhook";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const { id } = await params;
  const w = await webhookRepo.findById(ctx.tenantId, id);
  if (!w) return fail(404, "Not Found");
  return ok({
    id: w.id,
    url: w.url,
    events: w.events,
    active: w.active,
    description: w.description,
    lastDeliveredAt: w.lastDeliveredAt,
    createdAt: w.createdAt,
  });
});

export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;
  const body = WebhookUpdateSchema.parse(await req.json());

  const existing = await webhookRepo.findById(ctx.tenantId, id);
  if (!existing) return fail(404, "Not Found");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const updated = await prisma.$transaction(async (tx) => {
    const u = await webhookRepo.update(tx, id, body);
    await appendAudit(tx, {
      tenantId: ctx.tenantId,
      entity: "Webhook",
      entityId: id,
      action: "UPDATE",
      actorId,
      actorEmail,
      before: {
        url: existing.url,
        events: existing.events,
        active: existing.active,
      },
      after: { url: u.url, events: u.events, active: u.active },
    });
    return u;
  });

  return ok({
    id: updated.id,
    url: updated.url,
    events: updated.events,
    active: updated.active,
    description: updated.description,
  });
});

export const DELETE = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;
  const existing = await webhookRepo.findById(ctx.tenantId, id);
  if (!existing) return fail(404, "Not Found");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  await prisma.$transaction(async (tx) => {
    await webhookRepo.remove(tx, id);
    await appendAudit(tx, {
      tenantId: ctx.tenantId,
      entity: "Webhook",
      entityId: id,
      action: "DELETE",
      actorId,
      actorEmail,
      before: { url: existing.url },
    });
  });

  return noContent();
});
