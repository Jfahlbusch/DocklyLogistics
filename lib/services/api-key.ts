import crypto from "node:crypto";

const PREFIX_PREFIX = "dlg_live_";
const PREFIX_RANDOM_LEN = 24;
const SECRET_LEN = 32;
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function base62(bytes: Buffer): string {
  return Array.from(bytes).map((b) => BASE62[b % 62]).join("");
}

export type GeneratedApiKey = {
  prefix: string;       // "dlg_live_XXXXXXXX..."
  fullKey: string;      // "dlg_live_XXX.<SECRET>" — shown once to the user
  hash: string;         // sha-256 of secret (stored)
};

export function generateApiKey(): GeneratedApiKey {
  const prefixRand = base62(crypto.randomBytes(PREFIX_RANDOM_LEN));
  const prefix = `${PREFIX_PREFIX}${prefixRand}`;
  const secret = base62(crypto.randomBytes(SECRET_LEN));
  const hash = crypto.createHash("sha256").update(secret).digest("hex");
  return { prefix, fullKey: `${prefix}.${secret}`, hash };
}

/**
 * Parses an incoming X-API-Key header into prefix + secret.
 * Returns null if format invalid.
 */
export function parseApiKey(raw: string | null): { prefix: string; secret: string } | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const idx = trimmed.indexOf(".");
  if (idx <= 0) return null;
  const prefix = trimmed.slice(0, idx);
  const secret = trimmed.slice(idx + 1);
  if (!prefix.startsWith(PREFIX_PREFIX)) return null;
  if (secret.length === 0) return null;
  return { prefix, secret };
}

export function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

/**
 * Timing-safe compare of two hex strings of equal length.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
