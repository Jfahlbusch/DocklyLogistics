import type { Prisma } from "@prisma/client";
import { webhookRepo, deliveryRepo } from "@/lib/db/repos/webhook";

/**
 * Enqueue a webhook delivery for every active webhook of the tenant that subscribes
 * to `event`. Safe to call without a transaction — but if a transaction is provided,
 * the enqueues join it so they roll back atomically with the business change.
 */
export async function emitEvent(
  tx: Prisma.TransactionClient,
  tenantId: string,
  event: string,
  payload: Prisma.InputJsonValue,
): Promise<number> {
  const targets = await tx.webhook.findMany({ where: { tenantId, active: true, events: { has: event } } });
  for (const w of targets) {
    await deliveryRepo.enqueue(tx, { tenantId, webhookId: w.id, event, payload });
  }
  return targets.length;
}

// Re-export for convenience
export { webhookRepo };
