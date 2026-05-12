import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { supplierRepo } from "@/lib/db/repos/supplier";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, created, fail } from "@/lib/api/respond";
import { SupplierCreateSchema, SupplierListQuerySchema } from "@/lib/schemas/supplier";

export const GET = handler(async (req: NextRequest) => {
  const ctx = requireRoleFromHeaders(req.headers, "VIEWER");
  const query = SupplierListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const { items, total } = await supplierRepo.list({ tenantId: ctx.tenantId, ...query });
  return ok(items, { page: query.page, pageSize: query.pageSize, total });
});

export const POST = handler(async (req: NextRequest) => {
  const ctx = requireRoleFromHeaders(req.headers, "MANAGER");
  const body = SupplierCreateSchema.parse(await req.json());

  const dup = await supplierRepo.findByName(ctx.tenantId, body.name);
  if (dup) return fail(409, "Supplier name already exists");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const supplier = await prisma.$transaction(async (tx) => {
    const s = await supplierRepo.create(tx, ctx.tenantId, body);
    await appendAudit(tx, {
      tenantId: ctx.tenantId, entity: "Supplier", entityId: s.id, action: "CREATE",
      actorId, actorEmail,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
      after: { name: s.name, channel: s.channel },
    });
    return s;
  });

  return created(supplier);
});
