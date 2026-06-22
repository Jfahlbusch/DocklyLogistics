export type UserRole = "GLOBAL_ADMIN" | "MANAGER" | "USER" | "VIEWER";

export class UnauthorizedError extends Error {
  constructor(message = "User is not authorized to access this tenant") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

// Keycloak claim keys exist in two spellings across environments
// (`use_docklylogistic` and `use_docklylogistics`). We accept BOTH so role
// mapping is independent of the realm's exact attribute naming.
type Claims = {
  realm_access?: { roles?: string[] };
  manage_docklylogistic?: unknown;
  manage_docklylogistics?: unknown;
  internal_user_docklylogistic?: unknown;
  internal_user_docklylogistics?: unknown;
  use_docklylogistic?: unknown;
  use_docklylogistics?: unknown;
  [key: string]: unknown;
};

/** Normalize a claim value (string | string[] | undefined) to a string[]. */
function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") return value ? [value] : [];
  return [];
}

/** Read a claim by base name, accepting both the `…logistic` and `…logistics` spelling. */
function readClaim(claims: Claims, base: string): string[] {
  return [...asArray(claims[base]), ...asArray(claims[`${base}s`])];
}

export function deriveRole(claims: Claims, tenant: string): UserRole {
  const roles = claims.realm_access?.roles ?? [];
  if (roles.includes("global_admin")) return "GLOBAL_ADMIN";

  if (readClaim(claims, "manage_docklylogistic").includes(tenant)) return "MANAGER";
  if (readClaim(claims, "internal_user_docklylogistic").includes(tenant)) return "USER";
  if (readClaim(claims, "use_docklylogistic").includes(tenant)) return "VIEWER";

  throw new UnauthorizedError();
}
