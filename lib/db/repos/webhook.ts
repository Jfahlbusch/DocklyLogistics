import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";

export const webhookRepo = {
  async list(tenantId: string) {
    return prisma.webhook.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  },

  async findById(tenantId: string, id: string) {
    return prisma.webhook.findFirst({ where: { tenantId, id } });
  },

  async create(tx: Prisma.TransactionClient, data: {
    tenantId: string; url: string; events: string[]; description?: string | null;
    active?: boolean; secretEncrypted: string; createdBy: string;
  }) {
    return tx.webhook.create({
      data: {
        tenantId: data.tenantId, url: data.url, events: data.events,
        description: data.description ?? null, active: data.active ?? true,
        secretEncrypted: data.secretEncrypted, createdBy: data.createdBy,
      },
    });
  },

  async update(tx: Prisma.TransactionClient, id: string, patch: {
    url?: string; events?: string[]; description?: string | null; active?: boolean;
  }) {
    return tx.webhook.update({
      where: { id },
      data: {
        ...(patch.url !== undefined ? { url: patch.url } : {}),
        ...(patch.events !== undefined ? { events: patch.events } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.active !== undefined ? { active: patch.active } : {}),
      },
    });
  },

  async remove(tx: Prisma.TransactionClient, id: string) {
    return tx.webhook.delete({ where: { id } });
  },

  /** All active webhooks for tenant that subscribe to a given event. */
  async findForEvent(tenantId: string, event: string) {
    return prisma.webhook.findMany({ where: { tenantId, active: true, events: { has: event } } });
  },
};

export const deliveryRepo = {
  /** Enqueue a delivery in PENDING state, scheduled immediately. */
  async enqueue(tx: Prisma.TransactionClient, data: {
    tenantId: string; webhookId: string; event: string; payload: Prisma.InputJsonValue;
  }) {
    return tx.webhookDelivery.create({
      data: { tenantId: data.tenantId, webhookId: data.webhookId, event: data.event, payload: data.payload },
    });
  },

  /** Get up-to-N deliveries that are due (PENDING or FAILED-and-due). */
  async fetchDue(limit: number = 10) {
    return prisma.webhookDelivery.findMany({
      where: {
        status: { in: ["PENDING", "FAILED"] },
        nextAttemptAt: { lte: new Date() },
      },
      include: { webhook: true },
      orderBy: { nextAttemptAt: "asc" },
      take: limit,
    });
  },

  async markSuccess(id: string, statusCode: number) {
    return prisma.webhookDelivery.update({
      where: { id },
      data: { status: "SUCCESS", attempts: { increment: 1 }, lastStatusCode: statusCode, succeededAt: new Date(), lastError: null },
    });
  },

  async markFailedRetryLater(id: string, attempts: number, statusCode: number | null, error: string) {
    const base = 30_000; // 30s
    const expBackoff = base * Math.pow(2, attempts);
    const jitterPct = 0.25;
    const jitter = (Math.random() * 2 - 1) * jitterPct * expBackoff;
    const nextAttemptAt = new Date(Date.now() + Math.floor(expBackoff + jitter));
    return prisma.webhookDelivery.update({
      where: { id },
      data: { status: "FAILED", attempts: { increment: 1 }, lastStatusCode: statusCode, lastError: error.slice(0, 1000), nextAttemptAt },
    });
  },

  async markGivenUp(id: string, statusCode: number | null, error: string) {
    return prisma.webhookDelivery.update({
      where: { id },
      data: { status: "GIVEN_UP", attempts: { increment: 1 }, lastStatusCode: statusCode, lastError: error.slice(0, 1000), givenUpAt: new Date() },
    });
  },

  /**
   * Manually re-queue a FAILED or GIVEN_UP delivery: reset to PENDING with a fresh
   * retry budget so the worker picks it up again. Tenant- and webhook-scoped via
   * updateMany (returns the batch count; 0 = not found or not in a retryable state).
   */
  async requeue(
    tx: Prisma.TransactionClient,
    args: { tenantId: string; webhookId: string; deliveryId: string },
  ) {
    return tx.webhookDelivery.updateMany({
      where: {
        id: args.deliveryId,
        tenantId: args.tenantId,
        webhookId: args.webhookId,
        status: { in: ["FAILED", "GIVEN_UP"] },
      },
      data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date(), givenUpAt: null, lastError: null },
    });
  },
};
