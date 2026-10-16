import type { UserRole } from "./role";

/**
 * EINE Regel für den wirksamen Mandanten — benutzt von beiden Read-Points
 * (NextAuth-Session-Callback der Seiten und `middleware.ts` für die API-Header).
 * Nie zwei Kopien, die auseinanderlaufen.
 *
 * Die Ansicht (Cookie) zählt nur für GLOBAL_ADMIN. Jede andere Rolle bleibt im
 * Heim-Mandanten, egal was im Cookie steht — die Rolle kommt aus der Sitzung,
 * nie aus dem Cookie.
 */
export function resolveSessionTenant(
  role: UserRole | undefined,
  home: string | undefined,
  ansicht?: string | null,
): string | undefined {
  if (role !== "GLOBAL_ADMIN") return home;
  return ansicht && ansicht.length > 0 ? ansicht : home;
}

/**
 * Read-Point 2: aus der Middleware-Sitzung + Cookie-Wert die Rolle/den Mandanten
 * für die signierten `x-user-*`-Header. Geht von `homeTenant` (unveränderlich) aus,
 * nicht von `tenant`, damit der Override nicht doppelt oder gar nicht greift.
 * `null` → es werden keine Header gesetzt (keine/ungültige Sitzung).
 */
export function headerSessionFor(
  sess: { role?: UserRole | null; homeTenant?: string | null; tenant?: string | null } | null | undefined,
  ansicht: string | null | undefined,
): { role: UserRole; tenant: string } | null {
  if (!sess?.role) return null;
  const tenant = resolveSessionTenant(sess.role, sess.homeTenant ?? sess.tenant ?? undefined, ansicht);
  return tenant ? { role: sess.role, tenant } : null;
}
