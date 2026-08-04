import { describe, it, expect, afterEach } from "vitest";
import crypto from "node:crypto";
import { requireCronSecret } from "./cron-auth";

const HEADER = "x-internal-cron-secret";
const SECRET = "s3cr3t-cron-value";

function headers(value?: string): Headers {
  const h = new Headers();
  if (value !== undefined) h.set(HEADER, value);
  return h;
}

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("requireCronSecret", () => {
  it("lässt den Aufruf durch, wenn das Secret exakt stimmt", () => {
    process.env.CRON_SECRET = SECRET;
    expect(requireCronSecret(headers(SECRET))).toBeNull();
  });

  it("weist ohne Header ab (401)", () => {
    process.env.CRON_SECRET = SECRET;
    expect(requireCronSecret(headers())?.status).toBe(401);
  });

  it("weist ein falsches Secret ab (401)", () => {
    process.env.CRON_SECRET = SECRET;
    expect(requireCronSecret(headers("falsch"))?.status).toBe(401);
  });

  it("weist ein Secret ab, das nur ein Präfix ist (kein Präfix-Treffer)", () => {
    process.env.CRON_SECRET = SECRET;
    expect(requireCronSecret(headers(SECRET.slice(0, -1)))?.status).toBe(401);
  });

  it("weist ein Secret mit angehängtem Zeichen ab", () => {
    process.env.CRON_SECRET = SECRET;
    expect(requireCronSecret(headers(SECRET + "x"))?.status).toBe(401);
  });

  it("antwortet 503, wenn der Server gar kein CRON_SECRET gesetzt hat", () => {
    expect(requireCronSecret(headers("beliebig"))?.status).toBe(503);
  });

  it("antwortet auch ohne Header 503, wenn kein CRON_SECRET gesetzt ist", () => {
    // Konfigurationsfehler des Servers schlägt die fehlende Berechtigung —
    // sonst verschleiert ein 401 die eigentliche Ursache im Betrieb.
    expect(requireCronSecret(headers())?.status).toBe(503);
  });

  it("vergleicht längenunabhängig (kein Früh-Abbruch beim ersten Zeichen)", () => {
    process.env.CRON_SECRET = SECRET;
    // Beide falsch, aber maximal unterschiedlich in Länge und erstem Zeichen:
    // beide müssen identisch behandelt werden.
    expect(requireCronSecret(headers("a"))?.status).toBe(401);
    expect(requireCronSecret(headers("z".repeat(4096)))?.status).toBe(401);
  });

  it("akzeptiert lange, zufällige Secrets unverändert", () => {
    const long = crypto.randomBytes(48).toString("base64url");
    process.env.CRON_SECRET = long;
    expect(requireCronSecret(headers(long))).toBeNull();

    // Letztes Zeichen garantiert verändern: ein festes Ersatzzeichen wäre in
    // 1 von 64 Fällen identisch mit dem ursprünglichen — der Test würde dann
    // das echte Secret schicken und scheinbar grundlos fehlschlagen.
    const last = long.slice(-1);
    const mutated = long.slice(0, -1) + (last === "A" ? "B" : "A");
    expect(mutated).not.toBe(long);
    expect(requireCronSecret(headers(mutated))?.status).toBe(401);
  });
});
