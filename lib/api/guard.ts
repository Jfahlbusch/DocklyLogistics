import type { UserRole } from "@/lib/auth/role";

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
export function requireRoleFromHeaders(headers: Headers, minRole: UserRole): RequestContext {
  const role = headers.get("x-user-role");
  const tenant = headers.get("x-user-tenant");

  if (!role || !isUserRole(role)) {
    throw new UnauthenticatedError("Missing or invalid x-user-role header");
  }
  if (!tenant) {
    throw new UnauthenticatedError("Missing x-user-tenant header");
  }
  if (!hasMinRole(role, minRole)) {
    throw new ForbiddenError(`Role ${role} is below required ${minRole}`);
  }

  return { role, tenantId: tenant };
}
