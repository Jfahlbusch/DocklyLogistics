import { parseApiKey, hashSecret, timingSafeEqualHex } from "@/lib/services/api-key";
import { apiKeyRepo } from "@/lib/db/repos/api-key";

export type PublicAuthContext = {
  apiKeyId: string;
  prefix: string;
  tenantId: string;
  supplierId: string;
  supplierName: string;
  scopes: string[];
};

export class PublicAuthError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail?: string,
  ) {
    super(`${title}${detail ? ": " + detail : ""}`);
    this.name = "PublicAuthError";
  }
}

/**
 * Authenticates a public-API request by inspecting the `X-API-Key` (or
 * `Authorization: Bearer ...`) header. Validates: format, existence, revoked,
 * expired, supplier-active, secret hash and (optionally) required scope.
 *
 * On success the last-used timestamp is updated fire-and-forget — request
 * latency is unaffected by the write.
 */
export async function authenticatePublic(
  headers: Headers,
  requiredScope?: string,
): Promise<PublicAuthContext> {
  const raw =
    headers.get("x-api-key") ??
    headers.get("authorization")?.replace(/^bearer\s+/i, "") ??
    null;
  const parsed = parseApiKey(raw);
  if (!parsed) {
    throw new PublicAuthError(401, "Unauthenticated", "X-API-Key fehlt oder hat ungültiges Format");
  }

  const record = await apiKeyRepo.findByPrefix(parsed.prefix);
  if (!record) {
    throw new PublicAuthError(401, "Unauthenticated", "Unbekannter API-Key");
  }
  if (record.revokedAt) {
    throw new PublicAuthError(401, "Unauthenticated", "API-Key wurde widerrufen");
  }
  if (record.expiresAt && record.expiresAt < new Date()) {
    throw new PublicAuthError(401, "Unauthenticated", "API-Key ist abgelaufen");
  }
  if (!record.supplier.active) {
    throw new PublicAuthError(403, "Forbidden", "Lieferant inaktiv");
  }

  const submitted = hashSecret(parsed.secret);
  if (!timingSafeEqualHex(submitted, record.hash)) {
    throw new PublicAuthError(401, "Unauthenticated", "API-Key Secret falsch");
  }

  if (requiredScope && !record.scopes.includes(requiredScope)) {
    throw new PublicAuthError(403, "Forbidden", `Scope '${requiredScope}' fehlt`);
  }

  // Touch last-used (fire-and-forget; do not block the request)
  apiKeyRepo.touchLastUsed(record.id).catch(() => {});

  return {
    apiKeyId: record.id,
    prefix: record.prefix,
    tenantId: record.supplier.tenantId,
    supplierId: record.supplier.id,
    supplierName: record.supplier.name,
    scopes: record.scopes,
  };
}
