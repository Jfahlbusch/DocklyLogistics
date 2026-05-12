import type { Order, OrderStatus, Prisma } from "@prisma/client";
import { nextOrderNo } from "./order-number";
import { Prisma as PrismaNs } from "@prisma/client";
import { orderEventHash, GENESIS_PREV_HASH } from "@/lib/audit/chain";

export class OrderStatusError extends Error {
  constructor(message: string) { super(message); this.name = "OrderStatusError"; }
}

export type OrderItemInput = { articleId: string; qtyOrderUnit: number; unitPrice: number };

export const orderService = {
  /**
   * Record an OrderEvent (append-only) with hash chain.
   * Chain is per-order: prevHash = hash of previous event, or GENESIS for first.
   */
  async recordEvent(
    tx: Prisma.TransactionClient,
    args: {
      orderId: string;
      type: string;
      fromStatus?: OrderStatus | null;
      toStatus?: OrderStatus | null;
      actorId: string;
      actorEmail: string;
      ip?: string | null;
      userAgent?: string | null;
      payload?: Record<string, unknown>;
    },
  ) {
    const last = await tx.orderEvent.findFirst({
      where: { orderId: args.orderId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { hash: true },
    });
    const prevHash = last?.hash && last.hash.length === 64 ? last.hash : GENESIS_PREV_HASH;

    const createdAt = new Date();
    const payload = (args.payload ?? {}) as Prisma.InputJsonValue;
    const hash = orderEventHash(
      {
        orderId: args.orderId,
        type: args.type,
        fromStatus: args.fromStatus ?? null,
        toStatus: args.toStatus ?? null,
        actorId: args.actorId,
        payload,
        createdAt,
      },
      prevHash,
    );

    await tx.orderEvent.create({
      data: {
        orderId: args.orderId,
        type: args.type,
        fromStatus: args.fromStatus ?? null,
        toStatus: args.toStatus ?? null,
        actorId: args.actorId,
        actorEmail: args.actorEmail,
        ip: args.ip ?? null,
        userAgent: args.userAgent ?? null,
        payload,
        hash,
        prevHash,
        createdAt,
      },
    });
  },

  /**
   * Compute total + qtyBase for items based on Article.packFactor.
   * Returns enriched items + total.
   */
  async enrichItems(tx: Prisma.TransactionClient, items: OrderItemInput[]) {
    const articleIds = items.map((i) => i.articleId);
    const articles = await tx.article.findMany({ where: { id: { in: articleIds } } });
    const byId = new Map(articles.map((a) => [a.id, a]));
    const out = items.map((i) => {
      const a = byId.get(i.articleId);
      if (!a) throw new Error(`Article ${i.articleId} not found`);
      const qtyBase = i.qtyOrderUnit * a.packFactor;
      const lineTotal = i.qtyOrderUnit * i.unitPrice;
      return {
        articleId: i.articleId,
        qtyOrderUnit: i.qtyOrderUnit,
        qtyBase,
        unitPrice: new PrismaNs.Decimal(i.unitPrice),
        lineTotal: new PrismaNs.Decimal(lineTotal),
      };
    });
    const total = out.reduce((s, x) => s + Number(x.lineTotal), 0);
    return { items: out, total };
  },

  /**
   * Create a new Order in REVIEW (manually or from suggestions).
   * Caller must wrap in $transaction.
   */
  async create(
    tx: Prisma.TransactionClient,
    args: {
      tenantId: string;
      supplierId: string;
      currency?: string;
      notes?: string;
      items: OrderItemInput[];
      createdBy: string;
      actorId: string;
      actorEmail: string;
      ip?: string | null;
      userAgent?: string | null;
    },
  ): Promise<Order> {
    const orderNo = await nextOrderNo(tx, args.tenantId);
    const enriched = await orderService.enrichItems(tx, args.items);

    const order = await tx.order.create({
      data: {
        tenantId: args.tenantId,
        orderNo,
        supplierId: args.supplierId,
        status: "REVIEW",
        currency: args.currency ?? "EUR",
        total: new PrismaNs.Decimal(enriched.total),
        notes: args.notes ?? null,
        createdBy: args.createdBy,
        items: { create: enriched.items },
      },
    });

    await orderService.recordEvent(tx, {
      orderId: order.id,
      type: "CREATED",
      toStatus: "REVIEW",
      actorId: args.actorId,
      actorEmail: args.actorEmail,
      ip: args.ip,
      userAgent: args.userAgent,
      payload: { orderNo, supplierId: args.supplierId, itemCount: enriched.items.length, total: enriched.total },
    });

    return order;
  },

  /**
   * Transition the order to a new status, validating the transition is allowed.
   * Throws OrderStatusError if illegal.
   */
  async transition(
    tx: Prisma.TransactionClient,
    args: {
      orderId: string;
      to: OrderStatus;
      actorId: string;
      actorEmail: string;
      ip?: string | null;
      userAgent?: string | null;
      eventType: string;
      payload?: Record<string, unknown>;
      extraData?: Partial<Pick<Order, "sentAt" | "confirmedAt" | "cancelledAt" | "closedAt" | "pdfPath" | "pdfHash">>;
    },
  ): Promise<Order> {
    const current = await tx.order.findUnique({ where: { id: args.orderId } });
    if (!current) throw new OrderStatusError("Order not found");

    if (!isAllowed(current.status, args.to)) {
      throw new OrderStatusError(`Transition ${current.status} → ${args.to} not allowed`);
    }

    const updated = await tx.order.update({
      where: { id: args.orderId },
      data: { status: args.to, ...args.extraData },
    });

    await orderService.recordEvent(tx, {
      orderId: args.orderId,
      type: args.eventType,
      fromStatus: current.status,
      toStatus: args.to,
      actorId: args.actorId,
      actorEmail: args.actorEmail,
      ip: args.ip,
      userAgent: args.userAgent,
      payload: args.payload,
    });

    return updated;
  },
};

function isAllowed(from: OrderStatus, to: OrderStatus): boolean {
  // Edge list: each entry is `${from}->${to}`
  const allowed: Record<OrderStatus, OrderStatus[]> = {
    DRAFT:              ["REVIEW", "CANCELLED"],
    REVIEW:             ["APPROVED", "DRAFT", "CANCELLED"],
    APPROVED:           ["SENT", "REVIEW", "CANCELLED"],
    SENT:               ["CONFIRMED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"],
    CONFIRMED:          ["PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"],
    PARTIALLY_RECEIVED: ["PARTIALLY_RECEIVED", "RECEIVED"],
    RECEIVED:           ["CLOSED"],
    CLOSED:             [],
    CANCELLED:          [],
  };
  return allowed[from]?.includes(to) ?? false;
}
