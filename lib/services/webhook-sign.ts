import crypto from "node:crypto";

export type SignedPayload = {
  timestamp: string;
  signature: string;        // "sha256=..."
  body: string;             // raw stringified payload
};

export function signWebhook(body: string, secret: string, now: Date = new Date()): SignedPayload {
  const timestamp = String(Math.floor(now.getTime() / 1000));
  const mac = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return { timestamp, signature: `sha256=${mac}`, body };
}

export function verifyWebhookSignature(
  body: string, secret: string, timestamp: string, signature: string,
  toleranceSeconds: number = 300,
): { ok: boolean; reason?: string } {
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return { ok: false, reason: "invalid timestamp" };
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSeconds) return { ok: false, reason: "stale timestamp" };
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
  if (expected.length !== signature.length) return { ok: false, reason: "length mismatch" };
  const a = Buffer.from(expected); const b = Buffer.from(signature);
  if (!crypto.timingSafeEqual(a, b)) return { ok: false, reason: "signature mismatch" };
  return { ok: true };
}
