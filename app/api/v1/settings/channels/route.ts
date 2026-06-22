import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { tenantChannelRepo } from "@/lib/db/repos/tenant-channel";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, created } from "@/lib/api/respond";
import {
  TenantChannelConfigCreateSchema,
  TenantChannelConfigListQuerySchema,
} from "@/lib/schemas/tenant-channel";

export const GET = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const query = TenantChannelConfigListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const { items, total } = await tenantChannelRepo.list({ tenantId: ctx.tenantId, ...query });
  return ok(items, { page: query.page, pageSize: query.pageSize, total });
});

export const POST = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const body = TenantChannelConfigCreateSchema.parse(await req.json());

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const profile = await prisma.$transaction(async (tx) => {
    const p = await tenantChannelRepo.create(tx, ctx.tenantId, body);
    await appendAudit(tx, {
      tenantId: ctx.tenantId, entity: "TenantChannelConfig", entityId: p.id, action: "CREATE",
      actorId, actorEmail,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
      after: { channel: p.channel, label: p.label, isDefault: p.isDefault },
    });
    return p;
  });

  return created(profile);
});
