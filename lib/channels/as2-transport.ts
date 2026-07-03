import crypto from "node:crypto";
import { withRetry } from "./retry";
import { isBlockedUrl } from "@/lib/net/ssrf-guard";
import { signPayload, encryptMime, parseMdn } from "@/lib/edi/as2";

/**
 * Reusable AS2 transport: sign + encrypt a payload, POST it with AS2 headers
 * (retry on transient failures), then validate the synchronous signed MDN
 * (disposition + MIC). Pure transport — callers persist the EdiMessage. Used by
 * the EDI order channel and the SFTP outbox relay.
 */

const AS2_TIMEOUT_MS = 10_000;

class As2HttpError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = "As2HttpError";
  }
}

export type As2Identity = { as2Id: string; certificatePem: string; privateKeyPem: string };
export type As2Recipient = { as2Id: string; as2Url: string; as2CertificatePem: string };

export type As2SendResult =
  | { ok: true; status: number; mdnDisposition: string; micVerified: boolean }
  | { ok: false; error: string };

export function newAs2MessageId(prefix: string): string {
  const safe = prefix.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "msg";
  return `<as2-${safe}-${crypto.randomBytes(6).toString("hex")}@docklylogistics>`;
}

export async function sendAs2Raw(
  identity: As2Identity,
  recipient: As2Recipient,
  payload: string,
  opts: { messageId: string; idempotencyKey?: string; contentType?: string },
): Promise<As2SendResult> {
  if (isBlockedUrl(recipient.as2Url)) {
    return { ok: false, error: "AS2-URL zeigt auf ein internes/ungültiges Ziel (SSRF-Schutz)." };
  }
  try {
    const signed = signPayload(payload, opts.contentType ?? "application/edifact", identity);
    const enc = encryptMime(signed.body, signed.contentType, recipient.as2CertificatePem);

    const res = await withRetry(
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), AS2_TIMEOUT_MS);
        try {
          const r = await fetch(recipient.as2Url, {
            method: "POST",
            headers: {
              "Content-Type": enc.contentType,
              "AS2-Version": "1.2",
              "AS2-From": identity.as2Id,
              "AS2-To": recipient.as2Id,
              "Message-ID": opts.messageId,
              "MIME-Version": "1.0",
              "Disposition-Notification-To": identity.as2Id,
              ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
            },
            body: enc.body,
            signal: controller.signal,
          });
          if (!r.ok) {
            const retryable = r.status >= 500 || r.status === 429;
            throw new As2HttpError(`Partner antwortete HTTP ${r.status}`, retryable);
          }
          return { body: await r.text(), contentType: r.headers.get("content-type") ?? "", status: r.status };
        } catch (e) {
          if (e instanceof As2HttpError) throw e;
          throw new As2HttpError(`AS2-Übertragung fehlgeschlagen: ${(e as Error).message}`, true);
        } finally {
          clearTimeout(timeout);
        }
      },
      { attempts: 3, baseMs: 500, isRetryable: (e) => e instanceof As2HttpError && e.retryable },
    );

    const mdn = parseMdn(res.body, res.contentType, recipient.as2CertificatePem);
    if (!mdn.processed) throw new Error(`MDN meldet Fehler: ${mdn.disposition}`);
    if (mdn.micBase64 && mdn.micBase64 !== signed.micBase64) {
      throw new Error("MDN-MIC stimmt nicht mit gesendetem Inhalt überein");
    }
    return { ok: true, status: res.status, mdnDisposition: mdn.disposition, micVerified: !!mdn.micBase64 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
