import { prisma } from "@/lib/db/client";
import { stockRepo } from "@/lib/db/repos/stock";

export type DashboardData = {
  kpis: {
    belowMin: number;
    openOrders: number;
    receiptsToday: number;
    webhookErrors24h: number;
  };
  belowMinItems: Array<{
    id: string;
    sku: string;
    name: string;
    stock: number;
    minStock: number;
    orderUnit: string;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    entity: string;
    createdAt: string;
    actorEmail: string;
  }>;
};

/**
 * Single source of truth for the dashboard. Used by both the dashboard page
 * (server component) and GET /api/v1/dashboard so the data is identical and no
 * logic lives only behind the UI (API parity).
 */
export async function getDashboardData(tenantId: string): Promise<DashboardData> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const articles = await prisma.article.findMany({
    where: { tenantId, active: true, minStock: { gt: 0 } },
    select: { id: true, sku: true, name: true, minStock: true, orderUnit: true },
  });
  const totals = await stockRepo.totalsByArticle(
    tenantId,
    articles.map((a) => a.id),
  );
  const belowMin = articles
    .map((a) => ({ ...a, stock: totals.get(a.id) ?? 0 }))
    .filter((a) => a.stock < a.minStock)
    .sort((a, b) => a.stock - a.minStock - (b.stock - b.minStock));

  const [openOrders, receiptsToday, webhookErrors24h, recentAudit] = await Promise.all([
    prisma.order.count({ where: { tenantId, status: { notIn: ["CLOSED", "CANCELLED"] } } }),
    prisma.stockMovement.count({
      where: { tenantId, reason: "RECEIPT", refType: "ORDER", createdAt: { gte: todayStart } },
    }),
    prisma.webhookDelivery.count({ where: { tenantId, givenUpAt: { gte: dayAgo } } }),
    prisma.auditLog.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  return {
    kpis: { belowMin: belowMin.length, openOrders, receiptsToday, webhookErrors24h },
    belowMinItems: belowMin.map((a) => ({
      id: a.id,
      sku: a.sku,
      name: a.name,
      stock: a.stock,
      minStock: a.minStock,
      orderUnit: a.orderUnit,
    })),
    recentActivity: recentAudit.map((e) => ({
      id: e.id,
      action: e.action,
      entity: e.entity,
      createdAt: e.createdAt.toISOString(),
      actorEmail: e.actorEmail,
    })),
  };
}
