import type { UserRole } from "@/lib/auth/role";
import { resolveUserApiKey } from "./user-key-auth";
import { verifyUserHeaders } from "./user-headers";

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

type Authenticated = RequestContext & {
  /** Nur beim persönlichen API-Key gesetzt — bei einer Sitzung kommt die E-Mail aus `auth()`. */
  keyUserEmail?: string;
};

/**
 * Die eine Authentifizierung: signierte Sitzungs-Header oder persönlicher API-Key.
 * Wirft bei fehlender/unzureichender Berechtigung.
 */
async function authenticate(headers: Headers, minRole: UserRole): Promise<Authenticated> {
  const role = headers.get("x-user-role");
  const tenant = headers.get("x-user-tenant");

  // Session path: middleware set (and signed) these headers from the NextAuth JWT.
  const signed =
    !!role && !!tenant && (await verifyUserHeaders(role, tenant, headers.get("x-user-signature")));
  if (signed && role && isUserRole(role) && tenant) {
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
    return { role: keyCtx.role, tenantId: keyCtx.tenantId, keyUserEmail: keyCtx.userEmail };
  }

  throw new UnauthenticatedError("Missing session (x-user-role) or a valid X-API-Key");
}

/**
 * Reads the x-user-role and x-user-tenant headers that middleware.ts set after
 * NextAuth derived the role from Keycloak claims — but only if they carry a valid
 * x-user-signature (see lib/api/user-headers.ts). Unsigned or tampered headers are
 * ignored, never trusted: the request then has to authenticate with a real API key.
 * Throws if missing/insufficient.
 */
export async function requireRoleFromHeaders(
  headers: Headers,
  minRole: UserRole,
): Promise<RequestContext> {
  const { role, tenantId } = await authenticate(headers, minRole);
  return { role, tenantId };
}

export type UserRequestContext = RequestContext & { userEmail: string };

/** Vergleichbar machen: dieselbe Person liefert über Sitzung und API-Key dieselbe Adresse. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Wie `requireRoleFromHeaders`, liefert aber zusätzlich die E-Mail des Nutzers für
 * nutzerbezogene Daten (z. B. Lesestatus von Benachrichtigungen). Rolle und
 * Mandant kommen unverändert aus der einen Authentifizierung; die E-Mail stammt aus
 * der Sitzung (`auth()`) bzw. dem persönlichen API-Key — nie aus Request-Headern
 * oder -Body. Ohne ermittelbare E-Mail: `UnauthenticatedError`.
 */
export async function requireUserFromHeaders(
  headers: Headers,
  minRole: UserRole,
): Promise<UserRequestContext> {
  const { role, tenantId, keyUserEmail } = await authenticate(headers, minRole);
  if (keyUserEmail) return { role, tenantId, userEmail: normalizeEmail(keyUserEmail) };

  // Dynamisch: `@/lib/auth` zieht NextAuth/Keycloak nach — das braucht nur der Sitzungspfad.
  const { auth } = await import("@/lib/auth");
  const email = (await auth())?.user?.email;
  if (!email || !email.trim()) throw new UnauthenticatedError("Session without e-mail address");
  return { role, tenantId, userEmail: normalizeEmail(email) };
}
