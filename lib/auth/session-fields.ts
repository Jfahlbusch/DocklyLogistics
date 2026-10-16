import { deriveRole, UnauthorizedError, type UserRole } from "./role";
import { resolveSessionTenant } from "./session-tenant";

/** Strukturell kompatibel zum NextAuth-`JWT` (Record<string, unknown>). */
type TokenLike = Record<string, unknown>;

export type SessionFields = {
  role: UserRole | undefined;
  /** Wirksamer Mandant (bei GLOBAL_ADMIN ggf. der betrachtete). */
  tenant: string;
  /** Echter, unveränderlicher Mandant der Sitzung. */
  homeTenant: string;
  error?: "Unauthorized";
};

/**
 * Felder, die der NextAuth-Session-Callback an die Session hängt (Read-Point 1).
 * Bewusst eine reine Funktion (Cookie-Wert als Argument), damit sie ohne
 * Request-Kontext testbar ist.
 *
 * - `homeTenant` kommt aus dem JWT und ist unveränderlich; die Rolle wird aus den
 *   Claims des HEIM-Mandanten abgeleitet — ein Cookie kann sie nie ändern.
 * - `tenant` = `resolveSessionTenant(role, homeTenant, ansicht)`.
 * - Die Session enthält KEINE Claims und kein Access-Token (nur diese Felder).
 */
export function buildSessionFields(token: TokenLike, ansicht: string | null | undefined): SessionFields {
  const homeTenant =
    (typeof token.tenant === "string" && token.tenant) || process.env.NEXT_PUBLIC_APP_TENANT!;
  const claims = (token.claims ?? {}) as Parameters<typeof deriveRole>[0];
  try {
    const role = deriveRole(claims, homeTenant);
    return { role, tenant: resolveSessionTenant(role, homeTenant, ansicht) ?? homeTenant, homeTenant };
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[auth/session] deriveRole failed for tenant="${homeTenant}". Claims keys: ${Object.keys(claims).join(", ")}`,
        );
      }
      return { role: undefined, tenant: homeTenant, homeTenant, error: "Unauthorized" };
    }
    throw e;
  }
}
