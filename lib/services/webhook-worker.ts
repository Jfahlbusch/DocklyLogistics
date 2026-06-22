import { deliveryRepo } from "@/lib/db/repos/webhook";
import { decryptSecret } from "@/lib/crypto/aes";
import { signWebhook } from "./webhook-sign";
import { notificationRepo } from "@/lib/db/repos/notification";

const MAX_ATTEMPTS = 8;
const HTTP_TIMEOUT_MS = 10_000;

export type WorkerResult = {
  processed: number;
  succeeded: number;
  failed: number;
  givenUp: number;
};

export async function runWebhookWorker(limit: number = 10): Promise<WorkerResult> {
  const due = await deliveryRepo.fetchDue(limit);
  let succeeded = 0, failed = 0, givenUp = 0;

  // On permanent give-up, raise a tenant notification (surfaced in the header bell).
  const notifyFailed = (event: string, tenantId: string, detail: string) =>
    notificationRepo
      .create({
        tenantId,
        type: "webhook.failed",
        title: `Webhook fehlgeschlagen: ${event}`,
        body: detail.slice(0, 300),
        link: "/settings",
      })
      .catch(() => {});

  for (const d of due) {
    const wh = d.webhook;
    let secret: string;
    try {
      secret = decryptSecret(wh.secretEncrypted);
    } catch (e) {
      // Cannot decrypt — give up immediately to avoid infinite retries
      await deliveryRepo.markGivenUp(d.id, null, `decrypt-failed: ${(e as Error).message}`);
      await notifyFailed(d.event, d.tenantId, `decrypt-failed: ${(e as Error).message}`);
      givenUp++;
      continue;
    }

    const body = JSON.stringify({ event: d.event, deliveryId: d.id, tenantId: d.tenantId, payload: d.payload });
    const signed = signWebhook(body, secret);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

    let statusCode: number | null = null;
    let error: string | null = null;

    try {
      const res = await fetch(wh.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-DocklyLogistics-Timestamp": signed.timestamp,
          "X-DocklyLogistics-Signature": signed.signature,
          "X-DocklyLogistics-Event": d.event,
          "X-DocklyLogistics-Delivery": d.id,
        },
        body,
        signal: controller.signal,
      });
      statusCode = res.status;
      if (res.status >= 200 && res.status < 300) {
        await deliveryRepo.markSuccess(d.id, res.status);
        succeeded++;
      } else {
        const respBody = await res.text().catch(() => "");
        error = `HTTP ${res.status}: ${respBody.slice(0, 200)}`;
        if (d.attempts + 1 >= MAX_ATTEMPTS) {
          await deliveryRepo.markGivenUp(d.id, statusCode, error);
          await notifyFailed(d.event, d.tenantId, error);
          givenUp++;
        } else {
          await deliveryRepo.markFailedRetryLater(d.id, d.attempts, statusCode, error);
          failed++;
        }
      }
    } catch (e) {
      error = (e as Error).message;
      if (d.attempts + 1 >= MAX_ATTEMPTS) {
        await deliveryRepo.markGivenUp(d.id, statusCode, error);
        await notifyFailed(d.event, d.tenantId, error);
        givenUp++;
      } else {
        await deliveryRepo.markFailedRetryLater(d.id, d.attempts, statusCode, error);
        failed++;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return { processed: due.length, succeeded, failed, givenUp };
}
