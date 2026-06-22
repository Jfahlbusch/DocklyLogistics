import { Buffer } from "node:buffer";

export class ScalewayTemError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ScalewayTemError";
  }
}

/** TEM failures worth retrying: 5xx, 429 (rate limit), request timeout, or a
 *  network error. 4xx (bad request, domain not verified, …) are permanent. */
export function isRetryableTemError(e: unknown): boolean {
  if (e instanceof ScalewayTemError) return e.status >= 500 || e.status === 429;
  if (e instanceof DOMException && e.name === "AbortError") return true; // timeout
  if (e instanceof TypeError) return true; // fetch network failure
  return false;
}

/**
 * Scaleway Transactional Email (TEM) client.
 * API: POST https://api.scaleway.com/transactional-email/v1alpha1/regions/{region}/emails
 * Auth: X-Auth-Token header. Attachments base64, max 2 MB each.
 *
 * Global config via env — the Scaleway resource (domain + API secret key) is
 * provisioned separately. When unset, the email channel falls back to SMTP, then
 * to the local mock writer.
 */

export type ScalewayTemConfig = {
  secretKey: string;
  projectId: string;
  region: string;
};

export function getScalewayTemConfig(): ScalewayTemConfig | null {
  const secretKey = process.env.SCALEWAY_TEM_SECRET_KEY;
  const projectId = process.env.SCALEWAY_TEM_PROJECT_ID;
  if (!secretKey || !projectId) return null;
  return {
    secretKey,
    projectId,
    region: process.env.SCALEWAY_TEM_REGION || "fr-par",
  };
}

export type ScalewayMailParams = {
  from: { email: string; name: string };
  to: string;
  cc?: string[];
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { name: string; type: string; content: Buffer | Uint8Array }[];
};

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024; // Scaleway TEM hard limit

export async function sendViaScalewayTem(
  cfg: ScalewayTemConfig,
  p: ScalewayMailParams,
): Promise<{ messageId?: string }> {
  const attachments = (p.attachments ?? []).map((a) => {
    const buf = Buffer.from(a.content);
    if (buf.byteLength > MAX_ATTACHMENT_BYTES) {
      throw new Error(`Anhang '${a.name}' überschreitet das Scaleway-TEM-Limit von 2 MB.`);
    }
    return { name: a.name, type: a.type, content: buf.toString("base64") };
  });

  const body = {
    from: { email: p.from.email, name: p.from.name },
    to: [{ email: p.to }],
    ...(p.cc?.length ? { cc: p.cc.map((email) => ({ email })) } : {}),
    subject: p.subject,
    text: p.text,
    ...(p.html ? { html: p.html } : {}),
    project_id: cfg.projectId,
    ...(attachments.length ? { attachments } : {}),
    ...(p.replyTo ? { additional_headers: [{ key: "Reply-To", value: p.replyTo }] } : {}),
  };

  const url = `https://api.scaleway.com/transactional-email/v1alpha1/regions/${cfg.region}/emails`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "X-Auth-Token": cfg.secretKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ScalewayTemError(res.status, `Scaleway TEM ${res.status}: ${detail.slice(0, 300)}`);
  }

  const json = (await res.json().catch(() => null)) as {
    emails?: { message_id?: string }[];
  } | null;
  return { messageId: json?.emails?.[0]?.message_id };
}
