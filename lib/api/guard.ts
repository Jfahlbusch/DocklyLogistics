import type { UserRole } from "@/lib/auth/role";
import { resolveUserApiKey } from "./user-key-auth";

export class UnauthenticatedError extends Error {
  constructor(message = "Unauthenticated") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

const ROLE_PRIORITY: Record<UserRole, number> = {
  GLOBAL_ADMIN: 4,
  MANAGER: 3,
  USER: 2,
  VIEWER: 1,
};

export function hasMinRole(actual: UserRole, required: UserRole): boolean {
  return ROLE_PRIORITY[actual] >= ROLE_PRIORITY[required];
}

export type RequestContext = {
  role: UserRole;
  tenantId: string;
};

const VALID_ROLES = new Set<UserRole>(["GLOBAL_ADMIN", "MANAGER", "USER", "VIEWER"]);

function isUserRole(value: string): value is UserRole {
  return VALID_ROLES.has(value as UserRole);
}

/**
 * Reads the x-user-role and x-user-tenant headers that middleware.ts set after
 * NextAuth derived the role from Keycloak claims. Throws if missing/insufficient.
 */
export async function requireRoleFromHeaders(
  headers: Headers,
  minRole: UserRole,
): Promise<RequestContext> {
  const role = headers.get("x-user-role");
  const tenant = headers.get("x-user-tenant");

  // Session path: middleware set these headers from the NextAuth JWT.
  if (role && isUserRole(role) && tenant) {
    if (!hasMinRole(role, minRole)) {
      throw new ForbiddenError(`Role ${role} is below required ${minRole}`);
    }
    return { role, tenantId: tenant };
  }

  // Personal API-key path: X-API-Key / Authorization: Bearer. Same API as the UI,
  // scoped to the key's snapshot role + the user's tenant.
  const keyCtx = await resolveUserApiKey(headers);
  if (keyCtx) {
    if (!hasMinRole(keyCtx.role, minRole)) {
      throw new ForbiddenError(`Role ${keyCtx.role} is below required ${minRole}`);
    }
    return { role: keyCtx.role, tenantId: keyCtx.tenantId };
  }

  throw new UnauthenticatedError("Missing session (x-user-role) or a valid X-API-Key");
}
