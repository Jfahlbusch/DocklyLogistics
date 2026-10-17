/** Rundgang-URL einer Zone — der Inhalt des Zonen-QR (An-B8). Reine Funktion. */
export function zoneWalkUrl(baseUrl: string, zoneId: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/warehouse-mode?zone=${encodeURIComponent(zoneId)}`;
}

/**
 * Basis-URL der App, ausschließlich aus der Konfiguration (`NEXT_PUBLIC_APP_URL`,
 * Fallback `NEXTAUTH_URL`) — nie aus dem Host-Header (Host-Header-Injection).
 * Fehlt beides, wirft die Funktion mit klarer Meldung.
 */
export function appBaseUrl(env: Record<string, string | undefined> = process.env): string {
  const base = (env.NEXT_PUBLIC_APP_URL || env.NEXTAUTH_URL || "").trim();
  if (!base) {
    throw new Error("Weder NEXT_PUBLIC_APP_URL noch NEXTAUTH_URL ist gesetzt — Zonen-QR kann nicht erzeugt werden.");
  }
  return base;
}
