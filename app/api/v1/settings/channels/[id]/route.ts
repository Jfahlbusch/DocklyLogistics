import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { tenantChannelRepo } from "@/lib/db/repos/tenant-channel";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, noContent, fail } from "@/lib/api/respond";
import { TenantChannelConfigUpdateSchema } from "@/lib/schemas/tenant-channel";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = requireRoleFromHeaders(req.headers, "VIEWER");
  const { id } = await params;
  const p = await tenantChannelRepo.findById(ctx.tenantId, id);
  if (!p) return fail(404, "Not Found");
  return ok(p);
});

export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;
  const body = TenantChannelConfigUpdateSchema.parse(await req.json());

  const existing = await tenantChannelRepo.findById(ctx.tenantId, id);
  if (!existing) return fail(404, "Not Found");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tenantChannelRepo.update(tx, ctx.tenantId, id, body);
    await appendAudit(tx, {
      tenantId: ctx.tenantId, entity: "TenantChannelConfig", entityId: id, action: "UPDATE",
      actorId, actorEmail,
      before: { channel: existing.channel, label: existing.label, isDefault: existing.isDefault },
      after: { channel: u.channel, label: u.label, isDefault: u.isDefault },
    });
    return u;
  });

  return ok(updated);
});

export const DELETE = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;

  const existing = await tenantChannelRepo.findById(ctx.tenantId, id);
  if (!existing) return fail(404, "Not Found");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  await prisma.$transaction(async (tx) => {
    await tenantChannelRepo.remove(tx, id);
    await appendAudit(tx, {
      tenantId: ctx.tenantId, entity: "TenantChannelConfig", entityId: id, action: "DELETE",
      actorId, actorEmail,
      before: { channel: existing.channel, label: existing.label },
    });
  });

  return noContent();
});
