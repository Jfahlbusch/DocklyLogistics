import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/db/client";
import { makeRequest, routeParams } from "./helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => null) }));

import { POST } from "@/app/api/edi/inbound/[token]/route";

const T = "test-int-edi-inbound";
const OTHER = "test-int-edi-inbound-other";
const URL = (token: string) => `http://localhost/api/edi/inbound/${token}`;

const TOKEN = `edi_${crypto.randomBytes(8).toString("hex")}`;
const OTHER_TOKEN = `edi_${crypto.randomBytes(8).toString("hex")}`;
const PARTNER_TOKEN = `edi_p_${crypto.randomBytes(8).toString("hex")}`;
const INACTIVE_TOKEN = `edi_p_${crypto.randomBytes(8).toString("hex")}`;

const PARTNER_GLN = "4111111000005";
const ORDER_NO = "EDI-INB-1";

/** Gültiger ORDERS-Interchange; Absender-GLN steuerbar für den Bindungstest. */
function ordersFrom(senderGln: string, docNo = ORDER_NO): string {
  return (
    `UNB+UNOC:3+${senderGln}:14+4098765000004:14+260801:0900+ICINB1'` +
    "UNH+MINB1+ORDERS:D:96A:UN'" +
    `BGM+220+${docNo}+9'` +
    "DTM+137:20260801:102'" +
    `NAD+BY+${senderGln}::9'` +
    "NAD+SU+4098765000004::9'" +
    "CUX+2:EUR:9'" +
    "LIN+1++4099999000013:EN'" +
    "QTY+21:7:SA'" +
    "UNS+S'" +
    "UNT+10+MINB1'" +
    "UNZ+1+ICINB1'"
  );
}

async function cleanup() {
  const tenants = [T, OTHER];
  await prisma.ediMessage.deleteMany({ where: { tenantId: { in: tenants } } });
  await prisma.notification.deleteMany({ where: { tenantId: { in: tenants } } });
  await prisma.ediPartnerMailbox.deleteMany({ where: { tenantId: { in: tenants } } });
  await prisma.tenantEdiSettings.deleteMany({ where: { tenantId: { in: tenants } } });
  await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
}

/**
 * Diese Route ist ohne Session aus dem Internet erreichbar, und **der Token
 * bestimmt den Mandanten**. Ein Fehler im Token-Lookup wäre damit eine
 * mandantenübergreifende Dateninjektion — der wichtigste Nachweis hier.
 */
describe("/api/edi/inbound/[token]", () => {
  beforeAll(async () => {
    await cleanup();
    for (const t of [T, OTHER]) {
      await prisma.tenant.create({ data: { id: t, name: t } });
    }
    await prisma.tenantEdiSettings.create({
      data: { tenantId: T, inboundToken: TOKEN, inboundActive: true },
    });
    await prisma.tenantEdiSettings.create({
      data: { tenantId: OTHER, inboundToken: OTHER_TOKEN, inboundActive: true },
    });
    await prisma.ediPartnerMailbox.create({
      data: {
        tenantId: T, name: "Testpartner", token: PARTNER_TOKEN,
        partnerGln: PARTNER_GLN, active: true,
      },
    });
    await prisma.ediPartnerMailbox.create({
      data: {
        tenantId: T, name: "Gesperrter Partner", token: INACTIVE_TOKEN,
        partnerGln: PARTNER_GLN, active: false,
      },
    });
  });

  afterAll(cleanup);

  it("weist einen unbekannten Token ab und legt nichts an", async () => {
    const before = await prisma.ediMessage.count();
    const res = await POST(
      makeRequest(URL("edi_gibtesnicht"), { method: "POST", rawBody: ordersFrom(PARTNER_GLN) }),
      routeParams({ token: "edi_gibtesnicht" }),
    );
    expect(res.status).toBe(401);
    expect(await prisma.ediMessage.count()).toBe(before);
  });

  it("weist ein deaktiviertes Partner-Postfach ab", async () => {
    const res = await POST(
      makeRequest(URL(INACTIVE_TOKEN), { method: "POST", rawBody: ordersFrom(PARTNER_GLN) }),
      routeParams({ token: INACTIVE_TOKEN }),
    );
    expect(res.status).toBe(401);
  });

  it("weist ein deaktiviertes Tenant-Postfach ab (inboundActive = false)", async () => {
    await prisma.tenantEdiSettings.update({
      where: { tenantId: OTHER }, data: { inboundActive: false },
    });
    try {
      const res = await POST(
        makeRequest(URL(OTHER_TOKEN), { method: "POST", rawBody: ordersFrom(PARTNER_GLN) }),
        routeParams({ token: OTHER_TOKEN }),
      );
      expect(res.status).toBe(401);
    } finally {
      await prisma.tenantEdiSettings.update({
        where: { tenantId: OTHER }, data: { inboundActive: true },
      });
    }
  });

  it("schreibt ausschließlich in den Mandanten, der zum Token gehört", async () => {
    const res = await POST(
      makeRequest(URL(TOKEN), { method: "POST", rawBody: ordersFrom(PARTNER_GLN, "EDI-INB-TENANT") }),
      routeParams({ token: TOKEN }),
    );
    expect(res.status).toBe(202);

    const own = await prisma.ediMessage.findMany({ where: { tenantId: T } });
    const foreign = await prisma.ediMessage.findMany({ where: { tenantId: OTHER } });
    expect(own.length).toBeGreaterThan(0);
    expect(foreign).toHaveLength(0); // kein Übergriff auf den Nachbarmandanten
  });

  it("bindet einen Partner-Token an dessen Absender-GLN", async () => {
    // Passende GLN → verarbeitet
    const good = await POST(
      makeRequest(URL(PARTNER_TOKEN), { method: "POST", rawBody: ordersFrom(PARTNER_GLN, "EDI-INB-GOOD") }),
      routeParams({ token: PARTNER_TOKEN }),
    );
    expect(good.status).toBe(202);
    const okMsg = await prisma.ediMessage.findFirst({
      where: { tenantId: T, documentNo: "EDI-INB-GOOD" },
    });
    expect(okMsg?.status).toBe("PROCESSED");

    // Fremde GLN über dasselbe Postfach → als FAILED archiviert, nicht verarbeitet
    const bad = await POST(
      makeRequest(URL(PARTNER_TOKEN), { method: "POST", rawBody: ordersFrom("4999999999994", "EDI-INB-BAD") }),
      routeParams({ token: PARTNER_TOKEN }),
    );
    expect(bad.status).toBe(202); // Postfach-Semantik: Annahme bestätigt …
    const failed = await prisma.ediMessage.findFirst({
      where: { tenantId: T, createdBy: { contains: "Testpartner" }, status: "FAILED" },
      orderBy: { createdAt: "desc" },
    });
    expect(failed).not.toBeNull(); // … Ergebnis steht im Monitor
    expect(failed?.error).toContain("4999999999994");
  });

  it("weist einen leeren Payload ab (422)", async () => {
    const res = await POST(
      makeRequest(URL(TOKEN), { method: "POST", rawBody: "" }),
      routeParams({ token: TOKEN }),
    );
    expect(res.status).toBe(422);
  });

  it("weist einen Payload über 1 MB ab (413)", async () => {
    const huge = "U".repeat(1_000_001);
    const res = await POST(
      makeRequest(URL(TOKEN), { method: "POST", rawBody: huge }),
      routeParams({ token: TOKEN }),
    );
    expect(res.status).toBe(413);
  });
});
