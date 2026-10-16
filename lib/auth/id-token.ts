import { decode } from "next-auth/jwt";

/**
 * Das Keycloak-`id_token` wird für die Abmeldung gebraucht (`id_token_hint`) und liegt
 * deshalb im (verschlüsselten) JWT-Cookie — NIE in der Session für den Browser
 * (siehe `buildSessionFields`: die Session enthält keine Tokens/Claims).
 *
 * Alt-Sitzungen (vor Einführung angemeldet) haben kein `idToken` im JWT → dort bleibt es
 * bei der lokalen Abmeldung; die SSO-Sitzung in Keycloak endet erst mit dem nächsten Login.
 */
export function storeIdToken<T extends Record<string, unknown>>(
  token: T,
  account: { id_token?: string | null; [key: string]: unknown } | null | undefined,
): T & { idToken?: string } {
  if (account?.id_token) return { ...token, idToken: account.id_token };
  return token;
}

/**
 * Cookie-Namen der Auth.js-v5-Session (@auth/core `defaultCookies`): mit `__Secure-`-Präfix,
 * wenn die Basis-URL https ist (Prod), sonst ohne (lokal). Der Name dient zugleich als
 * `salt` der JWT-Verschlüsselung.
 */
export function sessionCookieNames(): string[] {
  return ["__Secure-authjs.session-token", "authjs.session-token"];
}

type CookieJar = { getAll(): Array<{ name: string; value: string }> };

/**
 * Liest das `idToken` aus dem Session-Cookie. Zu große JWTs zerlegt Auth.js in Chunks
 * `<name>.0`, `<name>.1` …; die werden numerisch sortiert zusammengesetzt. Jeder Fehler
 * (kein Cookie, falsches Secret, kaputtes JWE) ergibt `null` → lokale Abmeldung.
 */
export async function readIdTokenFromCookies(
  jar: CookieJar,
  secret: string | undefined,
): Promise<string | null> {
  if (!secret) return null;
  const all = jar.getAll();
  for (const name of sessionCookieNames()) {
    const chunkIndex = (n: string) => (n === name ? -1 : /^\.(\d+)$/.test(n.slice(name.length)) ? Number(n.slice(name.length + 1)) : null);
    const parts = all
      .filter((c) => c.name.startsWith(name) && chunkIndex(c.name) !== null)
      .sort((a, b) => chunkIndex(a.name)! - chunkIndex(b.name)!);
    if (parts.length === 0) continue;
    try {
      const decoded = await decode({ token: parts.map((p) => p.value).join(""), secret, salt: name });
      const idToken = decoded?.idToken;
      return typeof idToken === "string" && idToken ? idToken : null;
    } catch {
      return null;
    }
  }
  return null;
}
