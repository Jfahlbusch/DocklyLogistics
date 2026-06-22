import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { storageLocationRepo } from "@/lib/db/repos/storage-location";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, noContent, fail } from "@/lib/api/respond";
import { StorageLocationUpdateSchema } from "@/lib/schemas/storage-location";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const { id } = await params;
  const l = await storageLocationRepo.findById(ctx.tenantId, id);
  if (!l) return fail(404, "Not Found");
  return ok(l);
});

export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;
  const body = StorageLocationUpdateSchema.parse(await req.json());

  const existing = await storageLocationRepo.findById(ctx.tenantId, id);
  if (!existing) return fail(404, "Not Found");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const updated = await prisma.$transaction(async (tx) => {
    const u = await storageLocationRepo.update(tx, ctx.tenantId, id, body);
    await appendAudit(tx, {
      tenantId: ctx.tenantId, entity: "StorageLocation", entityId: id, action: "UPDATE",
      actorId, actorEmail,
      before: { code: existing.code, name: existing.name, zone: existing.zone },
      after: { code: u.code, name: u.name, zone: u.zone },
    });
    return u;
  });

  return ok(updated);
});

export const DELETE = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;
  const existing = await storageLocationRepo.findById(ctx.tenantId, id);
  if (!existing) return fail(404, "Not Found");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  await prisma.$transaction(async (tx) => {
    await storageLocationRepo.remove(tx, id);
    await appendAudit(tx, {
      tenantId: ctx.tenantId, entity: "StorageLocation", entityId: id, action: "DELETE",
      actorId, actorEmail,
      before: { code: existing.code, name: existing.name },
    });
  });

  return noContent();
});
