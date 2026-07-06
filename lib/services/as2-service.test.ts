import { describe, it, expect, afterAll } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/db/client";
import { as2Service } from "./as2-service";

// Encrypting the AS2 private key needs APP_KEY. Provision a throwaway key so the
// test is hermetic (matches lib/crypto/aes.test.ts) instead of depending on the
// ambient env — that dependency was exactly why this passed locally but failed CI.
process.env.APP_KEY = process.env.APP_KEY ?? crypto.randomBytes(32).toString("hex");

const T = `test-as2svc-${crypto.randomBytes(4).toString("hex")}`;
const AS2_ID = "TEST-AS2-UPPER";

describe("as2Service.processInbound addressing", () => {
  it("resolves the recipient AS2-ID case-insensitively (no 403 on case mismatch)", async () => {
    await prisma.tenant.create({ data: { id: T, name: T } });
    await as2Service.generateIdentity(T, AS2_ID); // creates key + cert for the tenant

    // Lowercased AS2-To → the tenant must still resolve; an unknown partner then
    // yields a signed failure MDN (kind "mdn"), NOT a plain 403 "unknown recipient".
    const res = await as2Service.processInbound({
      headers: {
        as2From: "some-unknown-partner",
        as2To: AS2_ID.toLowerCase(),
        messageId: "<case-test@partner>",
        contentType: "application/pkcs7-mime",
      },
      rawBody: "irrelevant",
    });
    expect(res.kind).toBe("mdn");
    if (res.kind === "mdn") expect(res.status).toBe(200);
  });

  it("returns a plain 403 only when no tenant matches the recipient at all", async () => {
    const res = await as2Service.processInbound({
      headers: {
        as2From: "x",
        as2To: "COMPLETELY-UNKNOWN-RECIPIENT-XYZ",
        messageId: "<x@y>",
        contentType: "application/pkcs7-mime",
      },
      rawBody: "irrelevant",
    });
    expect(res.kind).toBe("plain");
    if (res.kind === "plain") expect(res.status).toBe(403);
  });

  it("stores a FAILED monitor entry even for a broken BINARY body (NUL bytes)", async () => {
    // Regression: NUL-haltige Payloads ließen den ediMessage.create an der
    // Postgres-TEXT-Spalte scheitern — catch(() => {}) verschluckte das, und
    // die Fehlversuche (Dohle, 06.07.) blieben im Monitor unsichtbar.
    const { generateAs2Identity } = await import("@/lib/edi/as2");
    const partner = generateAs2Identity("BIN-PARTNER");
    await prisma.ediPartnerMailbox.create({
      data: {
        tenantId: T, name: "BinPartner", as2Id: "BIN-PARTNER", active: true,
        as2CertificatePem: partner.certificatePem,
        token: `edi_p_test${crypto.randomBytes(8).toString("hex")}`,
      },
    });
    // Roh-binärer Müll: DER-artiger Kopf + NUL-Bytes (keine \u-Escapes!).
    const rawBody = String.fromCharCode(48, 130, 3, 16) + "garbage" + String.fromCharCode(0, 0, 7);
    const res = await as2Service.processInbound({
      headers: {
        as2From: "BIN-PARTNER",
        as2To: AS2_ID,
        messageId: "<bin-body-test@partner>",
        contentType: "application/pkcs7-mime; smime-type=enveloped-data",
      },
      rawBody,
    });
    expect(res.kind).toBe("mdn"); // signierte Fehler-MDN geht trotzdem raus

    const failed = await prisma.ediMessage.findFirst({
      where: { tenantId: T, direction: "IN", type: "AS2", status: "FAILED" },
      orderBy: { createdAt: "desc" },
    });
    expect(failed).not.toBeNull();
    expect(failed!.payload).toContain("base64-kodiert"); // NUL-sicher abgelegt
  });
});

afterAll(async () => {
  await prisma.as2InboundReceipt.deleteMany({ where: { tenantId: T } });
  await prisma.ediMessage.deleteMany({ where: { tenantId: T } });
  await prisma.ediPartnerMailbox.deleteMany({ where: { tenantId: T } });
  await prisma.tenantEdiSettings.deleteMany({ where: { tenantId: T } });
  await prisma.tenant.deleteMany({ where: { id: T } });
  await prisma.$disconnect();
});
