import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { ZoneCreate, ZoneUpdate } from "@/lib/schemas/zone";
import { suggestedOrderQty } from "@/lib/domain/article-quantities";

const byText = (a: string, b: string) => a.localeCompare(b, "de", { numeric: true });

const COUNTS = { _count: { select: { locations: true, articles: true } } } as const;

type ZoneWithCount = Prisma.ZoneGetPayload<{ include: typeof COUNTS }>;

function present({ _count, ...z }: ZoneWithCount) {
  return { ...z, locationCount: _count.locations, articleCount: _count.articles };
}

export const zoneRepo = {
  async list(tenantId: string, opts: { q?: string; limit?: number } = {}) {
    const rows = await prisma.zone.findMany({
      where: {
        tenantId,
        ...(opts.q ? { name: { contains: opts.q, mode: "insensitive" } } : {}),
      },
      include: COUNTS,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      ...(opts.limit ? { take: opts.limit } : {}),
    });
    return rows.map(present);
  },

  async findById(tenantId: string, id: string) {
    const z = await prisma.zone.findFirst({ where: { tenantId, id }, include: COUNTS });
    return z ? present(z) : null;
  },

  async findByName(tenantId: string, name: string) {
    return prisma.zone.findFirst({ where: { tenantId, name } });
  },

  /** true, wenn die Zone existiert und zum Mandanten gehört. */
  async existsInTenant(tenantId: string, id: string) {
    return (await prisma.zone.count({ where: { tenantId, id } })) > 0;
  },

  /**
   * Artikel einer Zone in Rundgang-Reihenfolge (Lagerplatz-Code natürlich ↑, Name ↑,
   * ohne Lagerplatz zuletzt). Höchstens 4 Abfragen: Zone, Artikel (inkl. Lagerplatz),
   * Bestandssummen (groupBy), offene Vorschläge. `null` bei unbekannter/fremder Zone.
   */
  async walk(tenantId: string, zoneId: string) {
    const zone = await prisma.zone.findFirst({ where: { tenantId, id: zoneId }, select: { id: true, name: true } });
    if (!zone) return null;

    const articles = await prisma.article.findMany({
      where: { tenantId, zoneId, active: true },
      select: {
        id: true, sku: true, name: true, baseUnit: true, orderUnit: true, packFactor: true,
        minStock: true, targetStock: true, maxStock: true,
        defaultLocation: { select: { id: true, code: true, name: true } },
      },
    });
    if (articles.length === 0) return { zone, items: [] };

    const ids = articles.map((a) => a.id);
    const [sums, pending] = await Promise.all([
      prisma.stockBalance.groupBy({ by: ["articleId"], where: { tenantId, articleId: { in: ids } }, _sum: { quantity: true } }),
      prisma.orderSuggestion.findMany({
        where: { tenantId, articleId: { in: ids }, status: "PENDING" },
        select: { id: true, articleId: true, qtyOrderUnit: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const stock = new Map(sums.map((s) => [s.articleId, s._sum.quantity ?? 0]));
    const pend = new Map<string, { id: string; qtyOrderUnit: number }>();
    for (const p of pending) if (!pend.has(p.articleId)) pend.set(p.articleId, { id: p.id, qtyOrderUnit: p.qtyOrderUnit });

    const items = articles.map(({ defaultLocation, ...article }) => {
      const stockTotal = stock.get(article.id) ?? 0;
      return {
        article,
        location: defaultLocation,
        stockTotal,
        suggestedQty: suggestedOrderQty(article, stockTotal),
        pendingSuggestion: pend.get(article.id) ?? null,
      };
    });
    items.sort((a, b) => {
      if (a.location && !b.location) return -1;
      if (!a.location && b.location) return 1;
      if (a.location && b.location) {
        const c = byText(a.location.code, b.location.code);
        if (c !== 0) return c;
      }
      return byText(a.article.name, b.article.name);
    });
    return { zone, items };
  },

  async create(tx: Prisma.TransactionClient, tenantId: string, input: ZoneCreate) {
    return tx.zone.create({
      data: { tenantId, name: input.name, ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}), ...(input.active !== undefined ? { active: input.active } : {}) },
    });
  },

  async update(tx: Prisma.TransactionClient, tenantId: string, id: string, input: ZoneUpdate) {
    const res = await tx.zone.updateMany({
      where: { tenantId, id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
    if (res.count === 0) return null;
    return tx.zone.findFirst({ where: { tenantId, id } });
  },

  async remove(tx: Prisma.TransactionClient, tenantId: string, id: string) {
    return tx.zone.deleteMany({ where: { tenantId, id } });
  },
};
