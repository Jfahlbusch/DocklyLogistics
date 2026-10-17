import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import { appendAudit } from "@/lib/audit/append";
import { exceedsCapacity } from "@/lib/domain/article-quantities";

type ListArgs = {
  tenantId: string;
  status?: "PENDING" | "CONFIRMED" | "DISMISSED";
  articleId?: string;
  page: number;
  pageSize: number;
};

export const orderSuggestionRepo = {
  async list({ tenantId, status, articleId, page, pageSize }: ListArgs) {
    const where: Prisma.OrderSuggestionWhereInput = {
      tenantId,
      ...(status ? { status } : {}),
      ...(articleId ? { articleId } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.orderSuggestion.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          article: {
            select: { sku: true, name: true, minStock: true, orderUnit: true, packFactor: true },
          },
          supplier: { select: { id: true, name: true, channel: true } },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      }),
      prisma.orderSuggestion.count({ where }),
    ]);
    return { items, total };
  },

  async findById(tenantId: string, id: string) {
    return prisma.orderSuggestion.findFirst({ where: { tenantId, id } });
  },

  async createManual(
    tx: Prisma.TransactionClient,
    tenantId: string,
    input: {
      articleId: string;
      supplierId?: string | null;
      qtyOrderUnit: number;
      note?: string | null;
      createdBy: string;
    },
  ) {
    return tx.orderSuggestion.create({
      data: {
        tenantId,
        articleId: input.articleId,
        supplierId: input.supplierId ?? null,
        qtyOrderUnit: input.qtyOrderUnit,
        reason: "MANUAL_SCAN",
        status: "PENDING",
        note: input.note ?? null,
        createdBy: input.createdBy,
      },
    });
  },

  async update(
    tx: Prisma.TransactionClient,
    id: string,
    patch: { supplierId?: string | null; qtyOrderUnit?: number; note?: string | null },
  ) {
    return tx.orderSuggestion.update({
      where: { id },
      data: {
        ...(patch.supplierId !== undefined ? { supplierId: patch.supplierId ?? null } : {}),
        ...(patch.qtyOrderUnit !== undefined ? { qtyOrderUnit: patch.qtyOrderUnit } : {}),
        ...(patch.note !== undefined ? { note: patch.note ?? null } : {}),
      },
    });
  },

  async setStatus(
    tx: Prisma.TransactionClient,
    id: string,
    status: "CONFIRMED" | "DISMISSED",
  ) {
    return tx.orderSuggestion.update({ where: { id }, data: { status } });
  },

  /**
   * Setzt den offenen (PENDING) Vorschlag eines Artikels in EINER Transaktion:
   * Menge > 0 ersetzt bzw. legt an, Menge 0 verwirft (An-B5). Ein
   * transaktionsgebundener Advisory-Lock je Artikel serialisiert parallele
   * Aufrufe, sodass nie zwei offene Vorschläge entstehen (kein Unique-Index:
   * Bestandsdaten können Duplikate enthalten). Gibt null zurück, wenn der Artikel
   * nicht zum Mandanten gehört.
   */
  async setPendingForArticle(
    tenantId: string,
    articleId: string,
    input: {
      qtyOrderUnit: number;
      note?: string | null;
      actorId: string;
      actorEmail: string;
      ip?: string;
      userAgent?: string;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const article = await tx.article.findFirst({ where: { id: articleId, tenantId } });
      if (!article) return null;

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pending-suggestion:${articleId}`}))`;

      const [agg, primary, open] = await Promise.all([
        tx.stockBalance.aggregate({ where: { tenantId, articleId }, _sum: { quantity: true } }),
        tx.articleSupplier.findFirst({ where: { articleId, isPrimary: true }, select: { supplierId: true } }),
        tx.orderSuggestion.findFirst({
          where: { tenantId, articleId, status: "PENDING" },
          orderBy: { createdAt: "asc" },
        }),
      ]);
      const stockTotal = agg._sum.quantity ?? 0;
      const qty = input.qtyOrderUnit;
      const audit = {
        tenantId,
        entity: "OrderSuggestion",
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        ip: input.ip,
        userAgent: input.userAgent,
      };

      if (qty === 0) {
        if (!open) return { kind: "none" as const };
        const data = await tx.orderSuggestion.update({ where: { id: open.id }, data: { status: "DISMISSED" } });
        await appendAudit(tx, {
          ...audit,
          entityId: data.id,
          action: "UPDATE",
          before: { qty: open.qtyOrderUnit, status: "PENDING" },
          after: { articleSku: article.sku, qty: 0, status: "DISMISSED" },
        });
        return { kind: "dismissed" as const, data };
      }

      const capacityWarning = exceedsCapacity(article, stockTotal, qty);
      if (open) {
        const data = await tx.orderSuggestion.update({
          where: { id: open.id },
          data: {
            qtyOrderUnit: qty,
            reason: "MANUAL_SCAN",
            ...(input.note !== undefined ? { note: input.note } : {}),
          },
        });
        await appendAudit(tx, {
          ...audit,
          entityId: data.id,
          action: "UPDATE",
          before: { qty: open.qtyOrderUnit, reason: open.reason },
          after: { articleSku: article.sku, qty, reason: "MANUAL_SCAN" },
        });
        return { kind: "updated" as const, data, capacityWarning };
      }

      const data = await orderSuggestionRepo.createManual(tx, tenantId, {
        articleId,
        supplierId: primary?.supplierId ?? null,
        qtyOrderUnit: qty,
        note: input.note,
        createdBy: input.actorEmail,
      });
      await appendAudit(tx, {
        ...audit,
        entityId: data.id,
        action: "CREATE",
        after: { articleSku: article.sku, qty, reason: "MANUAL_SCAN" },
      });
      return { kind: "created" as const, data, capacityWarning };
    });
  },
};
