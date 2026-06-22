import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { supplierRepo } from "@/lib/db/repos/supplier";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, noContent, fail } from "@/lib/api/respond";
import { SupplierUpdateSchema } from "@/lib/schemas/supplier";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const { id } = await params;
  const s = await supplierRepo.findById(ctx.tenantId, id);
  if (!s) return fail(404, "Not Found");
  return ok(s);
});

export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;
  const body = SupplierUpdateSchema.parse(await req.json());

  const existing = await supplierRepo.findById(ctx.tenantId, id);
  if (!existing) return fail(404, "Not Found");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const updated = await prisma.$transaction(async (tx) => {
    const u = await supplierRepo.update(tx, ctx.tenantId, id, body);
    await appendAudit(tx, {
      tenantId: ctx.tenantId, entity: "Supplier", entityId: id, action: "UPDATE",
      actorId, actorEmail,
      before: { name: existing.name, channel: existing.channel },
      after: { name: u.name, channel: u.channel },
    });
    return u;
  });

  return ok(updated);
});

export const DELETE = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;
  const existing = await supplierRepo.findById(ctx.tenantId, id);
  if (!existing) return fail(404, "Not Found");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  await prisma.$transaction(async (tx) => {
    await supplierRepo.remove(tx, id);
    await appendAudit(tx, {
      tenantId: ctx.tenantId, entity: "Supplier", entityId: id, action: "DELETE",
      actorId, actorEmail,
      before: { name: existing.name },
    });
  });

  return noContent();
});
