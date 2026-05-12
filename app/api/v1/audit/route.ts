import type { NextRequest } from "next/server";
import type { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok } from "@/lib/api/respond";

const QuerySchema = z.object({
  entity: z.string().optional(),
  action: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const GET = handler(async (req: NextRequest) => {
  const ctx = requireRoleFromHeaders(req.headers, "VIEWER");
  const q = QuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const where: Prisma.AuditLogWhereInput = {
    tenantId: ctx.tenantId,
    ...(q.entity ? { entity: q.entity } : {}),
    ...(q.action ? { action: q.action as AuditAction } : {}),
    ...(q.from || q.to
      ? {
          createdAt: {
            ...(q.from ? { gte: new Date(q.from) } : {}),
            ...(q.to ? { lte: new Date(q.to) } : {}),
          },
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return ok(
    items.map((r) => ({
      id: r.id,
      entity: r.entity,
      entityId: r.entityId,
      action: r.action,
      actorId: r.actorId,
      actorEmail: r.actorEmail,
      ip: r.ip,
      before: r.before,
      after: r.after,
      hash: r.hash,
      prevHash: r.prevHash,
      createdAt: r.createdAt,
    })),
    { page: q.page, pageSize: q.pageSize, total },
  );
});
