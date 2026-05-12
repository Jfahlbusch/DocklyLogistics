import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { storageLocationRepo } from "@/lib/db/repos/storage-location";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, created, fail } from "@/lib/api/respond";
import { StorageLocationCreateSchema, StorageLocationListQuerySchema } from "@/lib/schemas/storage-location";

export const GET = handler(async (req: NextRequest) => {
  const ctx = requireRoleFromHeaders(req.headers, "VIEWER");
  const query = StorageLocationListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const { items, total } = await storageLocationRepo.list({ tenantId: ctx.tenantId, ...query });
  return ok(items, { page: query.page, pageSize: query.pageSize, total });
});

export const POST = handler(async (req: NextRequest) => {
  const ctx = requireRoleFromHeaders(req.headers, "MANAGER");
  const body = StorageLocationCreateSchema.parse(await req.json());

  const dup = await storageLocationRepo.findByCode(ctx.tenantId, body.code);
  if (dup) return fail(409, "StorageLocation code already exists");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const location = await prisma.$transaction(async (tx) => {
    const l = await storageLocationRepo.create(tx, ctx.tenantId, body);
    await appendAudit(tx, {
      tenantId: ctx.tenantId, entity: "StorageLocation", entityId: l.id, action: "CREATE",
      actorId, actorEmail,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
      after: { code: l.code, name: l.name, zone: l.zone },
    });
    return l;
  });

  return created(location);
});
