/**
 * Rolle und Mandant reisen von der Middleware zu den Route-Handlern als
 * Request-Header. Diese Header darf **nur** die Middleware setzen:
 *
 *  1. `forwardUserHeaders` entfernt jeden vom Client mitgeschickten `x-user-*`-
 *     Header und setzt die Werte der echten Sitzung neu.
 *  2. Die Werte werden mit HMAC-SHA-256 (Schlüssel: NEXTAUTH_SECRET) signiert;
 *     `requireRoleFromHeaders` akzeptiert nur gültig signierte Header.
 *
 * Hintergrund: Bis 16.10.2026 wurden Client-Header weder entfernt noch geprüft —
 * mit einem erfundenen X-API-Key und gefälschtem `x-user-role` war die gesamte
 * API ohne Anmeldung erreichbar. Beide Schichten zusammen schließen das; jede
 * allein genügt, damit ein Fehler in der anderen nicht wieder alles öffnet.
 *
 * Nur Web Crypto, damit dieselbe Datei in der Edge-Middleware und in Node läuft.
 */

export const USER_HEADERS = ["x-user-role", "x-user-tenant", "x-user-signature"] as const;

const PREFIX = "dockly-user-headers-v1";
const encoder = new TextEncoder();

function secretFromEnv(): string {
  const s = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET fehlt — x-user-Header können nicht signiert werden");
  return s;
}

/** Eindeutige Kodierung: Längenpräfixe verhindern Verschiebe-Tricks am Trennzeichen. */
function payload(role: string, tenant: string): string {
  return `${PREFIX}|${role.length}:${role}|${tenant.length}:${tenant}`;
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Vergleich in konstanter Zeit (keine Rückschlüsse über die Laufzeit). */
function equalConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signUserHeaders(role: string, tenant: string, secret = secretFromEnv()): Promise<string> {
  return hmacHex(payload(role, tenant), secret);
}

export async function verifyUserHeaders(
  role: string,
  tenant: string,
  signature: string | null | undefined,
  secret = secretFromEnv(),
): Promise<boolean> {
  if (!signature) return false;
  return equalConstantTime(await signUserHeaders(role, tenant, secret), signature);
}

/**
 * Request-Header für den Route-Handler: Kopie der eingehenden Header ohne jeden
 * `x-user-*`-Header; bei gültiger Sitzung Rolle, Mandant und Signatur neu gesetzt.
 */
export async function forwardUserHeaders(
  incoming: Headers,
  session: { role?: string | null; tenant?: string | null } | null,
): Promise<Headers> {
  const out = new Headers(incoming);
  for (const name of [...out.keys()]) {
    if (name.toLowerCase().startsWith("x-user-")) out.delete(name);
  }
  if (session?.role && session.tenant) {
    out.set("x-user-role", session.role);
    out.set("x-user-tenant", session.tenant);
    out.set("x-user-signature", await signUserHeaders(session.role, session.tenant));
  }
  return out;
}
