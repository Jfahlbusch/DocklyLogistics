/**
 * Cookie, über den ein GLOBAL_ADMIN vorübergehend einen anderen Mandanten als den eigenen
 * „betrachtet" (Server Components lesen ihn über `session.tenant`, API-Routen über den
 * signierten `x-user-tenant`-Header). Session-Cookie (kein `maxAge`): läuft mit dem
 * Browser-Fenster ab, damit ein vergessener Wechsel nicht über Tage unbemerkt aktiv bleibt.
 * Wird ausschließlich in `app/api/v1/me/tenant-view/route.ts` gesetzt/gelöscht, dort erst
 * NACH Prüfung von GLOBAL_ADMIN + Existenz des Ziel-Mandanten. Gelesen wird er nur über
 * `resolveSessionTenant` (`lib/auth/session-tenant.ts`) — dort zählt er ausschließlich
 * für die Rolle GLOBAL_ADMIN.
 */
export const ADMIN_VIEW_TENANT_COOKIE = "admin_view_tenant";
