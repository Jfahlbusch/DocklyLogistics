import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { AuditView } from "./audit-view";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  entity?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: string;
}>;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.role || !session.tenant) redirect("/login");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = 50;
  const where = {
    tenantId: session.tenant,
    ...(sp.entity ? { entity: sp.entity } : {}),
    ...(sp.from || sp.to
      ? {
          createdAt: {
            ...(sp.from ? { gte: new Date(sp.from) } : {}),
            ...(sp.to ? { lte: new Date(sp.to) } : {}),
          },
        }
      : {}),
  };

  const [items, total, distinctEntities] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where: { tenantId: session.tenant },
      distinct: ["entity"],
      select: { entity: true },
    }),
  ]);

  const rows = items.map((r) => ({
    id: r.id,
    entity: r.entity,
    entityId: r.entityId,
    action: r.action,
    actorEmail: r.actorEmail,
    ip: r.ip ?? "",
    before: r.before as unknown,
    after: r.after as unknown,
    hash: r.hash,
    prevHash: r.prevHash,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <AuditView
      rows={rows}
      total={total}
      entities={distinctEntities.map((e) => e.entity).sort()}
      filters={{ entity: sp.entity ?? "", from: sp.from ?? "", to: sp.to ?? "" }}
    />
  );
}
