import crypto from "node:crypto";
import type { NextResponse } from "next/server";
import { fail } from "./respond";

const HEADER = "x-internal-cron-secret";

/**
 * Timing-sicherer Vergleich zweier beliebiger Zeichenketten.
 *
 * `timingSafeEqualHex` (lib/services/api-key) taugt hier nicht: es interpretiert
 * seine Eingaben als Hex, ein Cron-Secret ist aber freier Text. Der Umweg über
 * SHA-256 macht beide Seiten gleich lang, sodass `timingSafeEqual` nutzbar wird
 * und die Laufzeit weder von der Länge noch von der Position der ersten
 * Abweichung abhängt.
 */
function secretsMatch(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest();
  const hb = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * Auth-Gate der internen Cron-Endpunkte (`/api/internal/**`). Diese Routen sind
 * ohne Session erreichbar; der geteilte Secret-Header ist ihr einziges Tor.
 *
 * @returns `null`, wenn der Aufruf durchgelassen wird — sonst die fertige
 *          Fehlerantwort, die der Handler unverändert zurückgeben soll.
 */
export function requireCronSecret(headers: Headers): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  // Fehlende Server-Konfiguration schlägt die fehlende Berechtigung: ein 401
  // würde im Betrieb die eigentliche Ursache verschleiern.
  if (!expected) return fail(503, "Cron not configured", "Server has no CRON_SECRET");

  const got = headers.get(HEADER);
  if (got === null || !secretsMatch(got, expected)) return fail(401, "Unauthorized");
  return null;
}
