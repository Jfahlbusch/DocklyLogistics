import { parseApiKey, hashSecret, timingSafeEqualHex } from "@/lib/services/api-key";
import { userApiKeyRepo } from "@/lib/db/repos/user-api-key";
import type { UserRole } from "@/lib/auth/role";

export type UserKeyContext = {
  keyId: string;
  tenantId: string;
  userId: string;
  userEmail: string;
  role: UserRole;
};

/**
 * Resolves a user's personal API key from the `X-API-Key` (or
 * `Authorization: Bearer …`) header to a tenant + role context. The role is the
 * snapshot taken at key creation (= the user's permissions then). Returns null on
 * any failure (missing/invalid/revoked/expired/wrong-secret) so the caller decides
 * the error; touches last-used fire-and-forget.
 */
export async function resolveUserApiKey(headers: Headers): Promise<UserKeyContext | null> {
  const raw =
    headers.get("x-api-key") ??
    headers.get("authorization")?.replace(/^bearer\s+/i, "") ??
    null;
  const parsed = parseApiKey(raw);
  if (!parsed) return null;

  const record = await userApiKeyRepo.findByPrefix(parsed.prefix);
  if (!record) return null;
  if (record.revokedAt) return null;
  if (record.expiresAt && record.expiresAt < new Date()) return null;

  const submitted = hashSecret(parsed.secret);
  if (!timingSafeEqualHex(submitted, record.hash)) return null;

  userApiKeyRepo.touchLastUsed(record.id).catch(() => {});

  return {
    keyId: record.id,
    tenantId: record.tenantId,
    userId: record.userId,
    userEmail: record.userEmail,
    role: record.role as UserRole,
  };
}
