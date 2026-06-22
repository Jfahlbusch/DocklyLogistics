import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { articleRepo } from "@/lib/db/repos/article";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, noContent, fail } from "@/lib/api/respond";
import { ArticleUpdateSchema } from "@/lib/schemas/article";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const { id } = await params;
  const a = await articleRepo.findById(ctx.tenantId, id);
  if (!a) return fail(404, "Not Found");
  return ok(a);
});

export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "USER");
  const { id } = await params;
  const body = ArticleUpdateSchema.parse(await req.json());

  const existing = await articleRepo.findById(ctx.tenantId, id);
  if (!existing) return fail(404, "Not Found");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const updated = await prisma.$transaction(async (tx) => {
    const u = await articleRepo.update(tx, ctx.tenantId, id, body);
    await appendAudit(tx, {
      tenantId: ctx.tenantId,
      entity: "Article",
      entityId: id,
      action: "UPDATE",
      actorId,
      actorEmail,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
      before: { sku: existing.sku, name: existing.name },
      after: { sku: u.sku, name: u.name },
    });
    return u;
  });

  return ok(updated);
});

export const DELETE = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;

  const existing = await articleRepo.findById(ctx.tenantId, id);
  if (!existing) return fail(404, "Not Found");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  await prisma.$transaction(async (tx) => {
    await articleRepo.remove(tx, id);
    await appendAudit(tx, {
      tenantId: ctx.tenantId,
      entity: "Article",
      entityId: id,
      action: "DELETE",
      actorId,
      actorEmail,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
      before: { sku: existing.sku, name: existing.name },
    });
  });

  return noContent();
});
