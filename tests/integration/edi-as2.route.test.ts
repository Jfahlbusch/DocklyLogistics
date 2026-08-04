import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/db/client";
import { makeRequest } from "./helpers";

// Das Verschlüsseln des AS2-Schlüssels braucht APP_KEY — hermetisch bereitstellen,
// damit der Test nicht von der Umgebung abhängt (vgl. lib/crypto/aes.test.ts).
process.env.APP_KEY = process.env.APP_KEY ?? crypto.randomBytes(32).toString("hex");

vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => null) }));

import { POST } from "@/app/api/edi/as2/route";
import { as2Service } from "@/lib/services/as2-service";

const T = "test-int-as2-route";
const AS2_ID = "TEST-INT-AS2-ROUTE";
const URL = "http://localhost/api/edi/as2";

function as2Headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "content-type": "application/pkcs7-mime; smime-type=enveloped-data",
    "message-id": `<int-${crypto.randomBytes(5).toString("hex")}@test>`,
    ...extra,
  };
}

async function cleanup() {
  await prisma.as2InboundReceipt.deleteMany({ where: { tenantId: T } });
  await prisma.ediMessage.deleteMany({ where: { tenantId: T } });
  await prisma.ediPartnerMailbox.deleteMany({ where: { tenantId: T } });
  await prisma.tenantEdiSettings.deleteMany({ where: { tenantId: T } });
  await prisma.tenant.deleteMany({ where: { id: T } });
}

/**
 * Der AS2-Endpunkt ist vollständig unauthentifiziert aus dem Internet
 * erreichbar; das Vertrauen hängt allein an der Zertifikatsprüfung. Geprüft
 * wird hier die Torfunktion der Route — die Kryptografie selbst deckt
 * lib/edi/as2.test.ts ab.
 */
describe("/api/edi/as2", () => {
  beforeAll(async () => {
    await cleanup();
    await prisma.tenant.create({ data: { id: T, name: T } });
    await as2Service.generateIdentity(T, AS2_ID);
  });

  afterAll(cleanup);

  it("weist einen Aufruf ohne AS2-From/AS2-To ab (400)", async () => {
    const res = await POST(makeRequest(URL, { method: "POST", headers: as2Headers(), rawBody: "egal" }));
    expect(res.status).toBe(400);
  });

  it("weist eine unbekannte Empfänger-Kennung ab (403) und legt nichts an", async () => {
    const before = await prisma.ediMessage.count();
    const res = await POST(
      makeRequest(URL, {
        method: "POST",
        headers: as2Headers({ "as2-from": "IRGENDWER", "as2-to": "GIBT-ES-NICHT-XYZ" }),
        rawBody: "egal",
      }),
    );
    expect(res.status).toBe(403);
    expect(await prisma.ediMessage.count()).toBe(before);
  });

  it("erkennt die eigene Kennung unabhängig von Groß-/Kleinschreibung", async () => {
    // Kleingeschrieben adressiert → darf NICHT als unbekannter Empfänger (403)
    // enden; genau dieser Fall hat einen realen Partner ausgesperrt.
    const res = await POST(
      makeRequest(URL, {
        method: "POST",
        headers: as2Headers({ "as2-from": "UNBEKANNTER-PARTNER", "as2-to": AS2_ID.toLowerCase() }),
        rawBody: "egal",
      }),
    );
    expect(res.status).toBe(200);
  });

  it("beantwortet einen unbekannten Partner mit signierter Fehler-MDN und macht ihn im Monitor sichtbar", async () => {
    const res = await POST(
      makeRequest(URL, {
        method: "POST",
        headers: as2Headers({ "as2-from": "UNBEKANNTER-PARTNER", "as2-to": AS2_ID }),
        rawBody: "egal",
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("signed");
    expect(res.headers.get("as2-from")).toBe(AS2_ID);
    expect(res.headers.get("as2-to")).toBe("UNBEKANNTER-PARTNER");

    const failed = await prisma.ediMessage.findFirst({
      where: { tenantId: T, direction: "IN", type: "AS2", status: "FAILED" },
      orderBy: { createdAt: "desc" },
    });
    expect(failed).not.toBeNull();
    expect(failed?.error).toContain("UNBEKANNTER-PARTNER");
  });

  it("weist einen Body über 2 MB ab (413)", async () => {
    const res = await POST(
      makeRequest(URL, {
        method: "POST",
        headers: as2Headers({ "as2-from": "X", "as2-to": AS2_ID }),
        rawBody: "A".repeat(2_000_001),
      }),
    );
    expect(res.status).toBe(413);
  });

  it("meldet einen defekten Krypto-Payload als FAILED, statt ihn stillschweigend zu verwerfen", async () => {
    const partner = (await import("@/lib/edi/as2")).generateAs2Identity("BIN-PARTNER-ROUTE");
    await prisma.ediPartnerMailbox.create({
      data: {
        tenantId: T, name: "Binärpartner", as2Id: "BIN-PARTNER-ROUTE", active: true,
        as2CertificatePem: partner.certificatePem,
        token: `edi_p_${crypto.randomBytes(8).toString("hex")}`,
      },
    });
    const before = await prisma.ediMessage.count({ where: { tenantId: T, status: "FAILED" } });

    const res = await POST(
      makeRequest(URL, {
        method: "POST",
        headers: as2Headers({ "as2-from": "BIN-PARTNER-ROUTE", "as2-to": AS2_ID }),
        rawBody: "kein gültiges PKCS#7",
      }),
    );
    expect(res.status).toBe(200); // signierte Fehler-MDN geht trotzdem raus
    const after = await prisma.ediMessage.count({ where: { tenantId: T, status: "FAILED" } });
    expect(after).toBe(before + 1);
  });
});
