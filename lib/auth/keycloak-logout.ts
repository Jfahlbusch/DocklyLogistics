/**
 * Keycloak-Abmeldung (RP-Initiated Logout) — reine Funktionen, ohne Request-Kontext testbar.
 *
 * Ohne Aufruf des `end_session_endpoint` bleibt die SSO-Sitzung in Keycloak aktiv und der
 * nächste „Login" meldet kommentarlos wieder an. Keycloak verlangt dafür `id_token_hint`
 * (sonst Rückfrage-Seite) und eine beim Client registrierte `post_logout_redirect_uri`.
 */

export type KeycloakLogoutInput = {
  /** Realm-URL, z. B. `https://sso.example/realms/dockly` (mit oder ohne Slash am Ende). */
  issuer: string | undefined;
  idToken: string | null | undefined;
  postLogoutRedirectUri: string;
  clientId: string | undefined;
};

/** `null`, wenn es nichts zu beenden gibt (kein idToken, z. B. Alt-Sitzung) → lokale Abmeldung. */
export function keycloakLogoutUrl({
  issuer,
  idToken,
  postLogoutRedirectUri,
  clientId,
}: KeycloakLogoutInput): string | null {
  if (!idToken || !issuer) return null;
  const params = new URLSearchParams({
    id_token_hint: idToken,
    post_logout_redirect_uri: postLogoutRedirectUri,
  });
  if (clientId) params.set("client_id", clientId);
  return `${issuer.replace(/\/+$/, "")}/protocol/openid-connect/logout?${params.toString()}`;
}

function parseBase(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.hostname === "0.0.0.0") return null; // Bind-Adresse, nie ein Ziel
    return u;
  } catch {
    return null;
  }
}

/**
 * Rücksprungadresse `<origin>/login`. Der Host aus dem Request (`x-forwarded-host`/`host`)
 * wird NUR übernommen, wenn er (samt Port) zu einer erlaubten Basisadresse passt
 * (`NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`); sonst gilt die erste gültige Basisadresse.
 * Protokoll und Host des Ergebnisses stammen damit immer aus der Konfiguration — nie aus
 * dem Header (Host-Header-Injection / Open Redirect). `null`, wenn keine Basis gültig ist.
 */
export function resolvePostLogoutRedirectUri({
  requestHost,
  allowedBaseUrls,
}: {
  requestHost: string | null | undefined;
  allowedBaseUrls: Array<string | undefined>;
}): string | null {
  const bases = allowedBaseUrls.map(parseBase).filter((b): b is URL => b !== null);
  if (bases.length === 0) return null;

  // x-forwarded-host kann eine Liste sein („a, b") — nur der erste Eintrag zählt.
  const host = requestHost?.split(",")[0]?.trim().toLowerCase();
  const match = host ? bases.find((b) => b.host.toLowerCase() === host) : undefined;
  return `${(match ?? bases[0]).origin}/login`;
}
