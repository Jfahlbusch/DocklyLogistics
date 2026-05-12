export type UserRole = "GLOBAL_ADMIN" | "MANAGER" | "USER" | "VIEWER";

export class UnauthorizedError extends Error {
  constructor(message = "User is not authorized to access this tenant") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

type Claims = {
  realm_access?: { roles?: string[] };
  manage_docklylogistic?: string[];
  internal_user_docklylogistic?: string[];
  use_docklylogistic?: string[];
};

export function deriveRole(claims: Claims, tenant: string): UserRole {
  const roles = claims.realm_access?.roles ?? [];
  if (roles.includes("global_admin")) return "GLOBAL_ADMIN";

  const manage = claims.manage_docklylogistic ?? [];
  if (manage.includes(tenant)) return "MANAGER";

  const internal = claims.internal_user_docklylogistic ?? [];
  if (internal.includes(tenant)) return "USER";

  const use = claims.use_docklylogistic ?? [];
  if (use.includes(tenant)) return "VIEWER";

  throw new UnauthorizedError();
}
