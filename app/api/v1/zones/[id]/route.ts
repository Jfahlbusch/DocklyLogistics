import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { zoneRepo } from "@/lib/db/repos/zone";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, noContent, fail } from "@/lib/api/respond";
import { ZoneUpdateSchema } from "@/lib/schemas/zone";

type Ctx = { params: Promise<{ id: string }> };

async function actor() {
  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  return { actorEmail, actorId: (session.user as { id?: string }).id ?? actorEmail };
}

export const GET = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const { id } = await params;
  const z = await zoneRepo.findById(ctx.tenantId, id);
  if (!z) return fail(404, "Not Found");
  return ok(z);
});

export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;
  const body = ZoneUpdateSchema.parse(await req.json());

  const existing = await zoneRepo.findById(ctx.tenantId, id);
  if (!existing) return fail(404, "Not Found");

  if (body.name !== undefined && body.name !== existing.name) {
    if (await zoneRepo.findByName(ctx.tenantId, body.name)) return fail(409, "Zone name already exists");
  }

  const { actorId, actorEmail } = await actor();
  try {
    await prisma.$transaction(async (tx) => {
      const u = await zoneRepo.update(tx, ctx.tenantId, id, body);
      if (!u) throw new Error("zone vanished");
      await appendAudit(tx, {
        tenantId: ctx.tenantId, entity: "Zone", entityId: id, action: "UPDATE",
        actorId, actorEmail,
        before: { name: existing.name, sortOrder: existing.sortOrder, active: existing.active },
        after: { name: u.name, sortOrder: u.sortOrder, active: u.active },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return fail(409, "Zone name already exists");
    }
    throw err;
  }
  return ok(await zoneRepo.findById(ctx.tenantId, id));
});

export const DELETE = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;
  const existing = await zoneRepo.findById(ctx.tenantId, id);
  if (!existing) return fail(404, "Not Found");
  if (existing.locationCount > 0 || existing.articleCount > 0) {
    return fail(409, "Zone in use", "Zone ist Lagerplätzen oder Artikeln zugeordnet.", {
      locationCount: existing.locationCount, articleCount: existing.articleCount,
    });
  }

  const { actorId, actorEmail } = await actor();
  try {
    await prisma.$transaction(async (tx) => {
      await zoneRepo.remove(tx, ctx.tenantId, id);
      await appendAudit(tx, {
        tenantId: ctx.tenantId, entity: "Zone", entityId: id, action: "DELETE",
        actorId, actorEmail,
        before: { name: existing.name },
      });
    });
  } catch (err) {
    // Lagerplatz wurde zwischen Prüfung und Löschen zugeordnet (FK Restrict)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return fail(409, "Zone in use");
    }
    throw err;
  }
  return noContent();
});
