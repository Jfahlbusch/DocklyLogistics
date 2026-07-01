import { prisma } from "@/lib/db/client";
import { classifyInbound, type ClassifiedInbound } from "@/lib/edi/inbound";
import { ediMessageRepo } from "@/lib/db/repos/edi-message";
import { tenantEdiSettingsRepo } from "@/lib/db/repos/tenant-edi-settings";
import { notificationRepo } from "@/lib/db/repos/notification";
import { orderService, OrderStatusError } from "@/lib/services/order-service";
import { appendAudit } from "@/lib/audit/append";
import { emitEvent } from "@/lib/services/webhook-emit";
import type { Prisma } from "@prisma/client";

export type InboundProcessResult = {
  messageId: string;
  type: string;
  status: "PROCESSED" | "FAILED";
  orderId?: string | null;
  note?: string;
  error?: string;
};

const EDI_ACTOR = { actorId: "edi-inbound", actorEmail: "edi@system" };

/**
 * Per-tenant EDI processing. Inbound flow: persist first (the mailbox never
 * loses a payload), then process; failures mark the message FAILED with a
 * readable error instead of throwing at the caller.
 */
export const ediService = {
  /** Handle one raw inbound interchange for a tenant. */
  async processInbound(args: {
    tenantId: string;
    raw: string;
    transport?: string;
    createdBy?: string;
  }): Promise<InboundProcessResult> {
    const { tenantId, raw } = args;
    const transport = args.transport ?? "inbound";
    const createdBy = args.createdBy ?? "edi-inbound";

    let classified: ClassifiedInbound;
    try {
      classified = classifyInbound(raw);
    } catch (e) {
      const msg = await ediMessageRepo.create({
        tenantId, direction: "IN", type: "UNKNOWN", status: "FAILED",
        transport, payload: raw, createdBy,
        error: `EDIFACT nicht parsebar: ${e instanceof Error ? e.message : String(e)}`,
      });
      return { messageId: msg.id, type: "UNKNOWN", status: "FAILED", error: msg.error ?? undefined };
    }

    const record = await ediMessageRepo.create({
      tenantId,
      direction: "IN",
      type: classified.kind === "UNKNOWN" ? (classified.messageType ?? "UNKNOWN") : classified.kind,
      status: "RECEIVED",
      transport,
      payload: raw,
      interchangeRef: classified.interchange.envelope?.interchangeRef ?? null,
      createdBy,
    });

    return this.processClassified(record.id, tenantId, classified);
  },

  /** Re-run processing for a stored inbound message (monitor action). */
  async reprocess(tenantId: string, messageId: string): Promise<InboundProcessResult> {
    const msg = await ediMessageRepo.findInTenant(tenantId, messageId);
    if (!msg) throw new Error("EDI-Nachricht nicht gefunden");
    if (msg.direction !== "IN") throw new Error("Nur eingehende Nachrichten können erneut verarbeitet werden");

    let classified: ClassifiedInbound;
    try {
      classified = classifyInbound(msg.payload);
    } catch (e) {
      await ediMessageRepo.update(msg.id, {
        status: "FAILED",
        error: `EDIFACT nicht parsebar: ${e instanceof Error ? e.message : String(e)}`,
      });
      return { messageId: msg.id, type: msg.type, status: "FAILED" };
    }
    await ediMessageRepo.update(msg.id, { status: "RECEIVED", error: null });
    return this.processClassified(msg.id, tenantId, classified);
  },

  /** Shared processing after classification. */
  async processClassified(
    messageId: string,
    tenantId: string,
    classified: ClassifiedInbound,
  ): Promise<InboundProcessResult> {
    if (classified.kind === "ORDRSP") {
      return this.processOrdrsp(messageId, tenantId, classified);
    }
    if (classified.kind === "ORDERS") {
      return this.processInboundOrders(messageId, tenantId, classified);
    }
    const error = `Nachrichtentyp ${classified.messageType ?? "?"} wird nicht unterstützt (nur ORDERS/ORDRSP)`;
    await ediMessageRepo.update(messageId, { status: "FAILED", error });
    return { messageId, type: classified.messageType ?? "UNKNOWN", status: "FAILED", error };
  },

  async processOrdrsp(
    messageId: string,
    tenantId: string,
    c: Extract<ClassifiedInbound, { kind: "ORDRSP" }>,
  ): Promise<InboundProcessResult> {
    const parsed = c.data as unknown as Prisma.InputJsonValue;
    try {
      const ref = c.data.orderReference;
      if (!ref) throw new Error("ORDRSP ohne Bestell-Referenz (RFF+ON fehlt)");

      const order = await prisma.order.findFirst({ where: { tenantId, orderNo: ref } });
      if (!order) throw new Error(`Bestellung ${ref} nicht gefunden`);

      const base = { documentNo: c.data.documentNo ?? ref, orderId: order.id, parsed };
      const settings = await tenantEdiSettingsRepo.ensure(tenantId);

      // DE 4343: 27 = rejected
      if (c.data.responseCode === "27") {
        await ediMessageRepo.update(messageId, { ...base, status: "PROCESSED" });
        await notificationRepo.create({
          tenantId, type: "edi.ordrsp.rejected",
          title: `EDI: Lieferant hat Bestellung ${ref} abgelehnt`,
          body: "Die ORDRSP-Antwort trägt den Antwortcode 27 (abgelehnt).",
          link: "/edi",
        });
        return { messageId, type: "ORDRSP", status: "PROCESSED", orderId: order.id, note: "abgelehnt" };
      }

      if (order.status === "CONFIRMED") {
        await ediMessageRepo.update(messageId, { ...base, status: "PROCESSED" });
        return { messageId, type: "ORDRSP", status: "PROCESSED", orderId: order.id, note: "bereits bestätigt" };
      }

      if (!settings.autoConfirm) {
        await ediMessageRepo.update(messageId, { ...base, status: "PROCESSED" });
        await notificationRepo.create({
          tenantId, type: "edi.ordrsp.received",
          title: `EDI: Bestellbestätigung für ${ref} eingegangen`,
          body: "Auto-Bestätigen ist deaktiviert — Bestellung manuell prüfen.",
          link: "/edi",
        });
        return { messageId, type: "ORDRSP", status: "PROCESSED", orderId: order.id, note: "autoConfirm aus" };
      }

      if (!["SENT", "PARTIALLY_RECEIVED"].includes(order.status)) {
        throw new Error(`Status ${order.status} erlaubt keine Bestätigung`);
      }

      await prisma.$transaction(async (tx) => {
        await orderService.transition(tx, {
          orderId: order.id,
          to: "CONFIRMED",
          ...EDI_ACTOR,
          eventType: "STATUS_CHANGED",
          payload: {
            source: "edi",
            interchangeRef: c.interchange.envelope?.interchangeRef ?? null,
            responseCode: c.data.responseCode ?? null,
            ediMessageId: messageId,
          },
          extraData: { confirmedAt: new Date() },
        });
        await appendAudit(tx, {
          tenantId,
          entity: "Order",
          entityId: order.id,
          action: "STATUS_CHANGE",
          ...EDI_ACTOR,
          before: { status: order.status },
          after: { status: "CONFIRMED", source: "edi" },
        });
        await emitEvent(tx, tenantId, "order.confirmed", {
          orderId: order.id,
          orderNo: order.orderNo,
          supplierId: order.supplierId,
          source: "edi",
        });
      });

      await ediMessageRepo.update(messageId, { ...base, status: "PROCESSED", supplierId: order.supplierId });
      await notificationRepo.create({
        tenantId, type: "edi.ordrsp.confirmed",
        title: `EDI: Bestellung ${ref} vom Lieferanten bestätigt`,
        link: "/edi",
      });
      return { messageId, type: "ORDRSP", status: "PROCESSED", orderId: order.id };
    } catch (e) {
      const error =
        e instanceof OrderStatusError || e instanceof Error ? e.message : String(e);
      await ediMessageRepo.update(messageId, { status: "FAILED", error, parsed });
      return { messageId, type: "ORDRSP", status: "FAILED", error };
    }
  },

  async processInboundOrders(
    messageId: string,
    tenantId: string,
    c: Extract<ClassifiedInbound, { kind: "ORDERS" }>,
  ): Promise<InboundProcessResult> {
    try {
      // Match lines to our articles by EAN first, SKU second.
      const eans = c.data.lines.map((l) => l.ean).filter((v): v is string => !!v);
      const skus = c.data.lines.map((l) => l.sku).filter((v): v is string => !!v);
      const articles = await prisma.article.findMany({
        where: {
          tenantId,
          OR: [
            ...(eans.length ? [{ eanGtin: { in: eans } }] : []),
            ...(skus.length ? [{ sku: { in: skus } }] : []),
          ],
        },
        select: { id: true, sku: true, eanGtin: true, name: true },
      });
      const byEan = new Map(articles.filter((a) => a.eanGtin).map((a) => [a.eanGtin!, a]));
      const bySku = new Map(articles.map((a) => [a.sku, a]));

      const lines = c.data.lines.map((l) => {
        const match = (l.ean && byEan.get(l.ean)) || (l.sku && bySku.get(l.sku)) || null;
        return { ...l, articleId: match?.id ?? null, articleName: match?.name ?? null };
      });
      const matched = lines.filter((l) => l.articleId).length;

      await ediMessageRepo.update(messageId, {
        status: "PROCESSED",
        documentNo: c.data.documentNo,
        parsed: { ...c.data, lines, matchedLines: matched } as unknown as Prisma.InputJsonValue,
      });
      await notificationRepo.create({
        tenantId, type: "edi.orders.received",
        title: `EDI: Bestellung ${c.data.documentNo ?? "(ohne Nr.)"} eingegangen`,
        body: `${lines.length} Positionen, ${matched} Artikeln zugeordnet.`,
        link: "/edi",
      });
      return { messageId, type: "ORDERS", status: "PROCESSED" };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await ediMessageRepo.update(messageId, { status: "FAILED", error });
      return { messageId, type: "ORDERS", status: "FAILED", error };
    }
  },
};
