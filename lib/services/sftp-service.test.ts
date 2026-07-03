import { describe, it, expect, afterAll } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/db/client";
import { resolveRecipientFromEdifact, findRelayTarget, sftpService } from "./sftp-service";

const T = `test-sftp-${crypto.randomBytes(4).toString("hex")}`;
const PARTNER_GLN = "4333228000009";
const SUPP_GLN = "4055500360010";

const INVOIC = (recipientGln: string) =>
  "UNA:+.? '\n" +
  `UNB+UNOC:3+4170000041474:14+${recipientGln}:14+260703:1200+ICINV1'\n` +
  "UNH+MEINV1+INVOIC:D:96A:UN'\n" +
  "BGM+380+RE-2026-0001+9'\n" +
  "UNT+3+MEINV1'\n" +
  "UNZ+1+ICINV1'";

describe("resolveRecipientFromEdifact", () => {
  it("reads the UNB recipient id", () => {
    expect(resolveRecipientFromEdifact(INVOIC(PARTNER_GLN))).toBe(PARTNER_GLN);
  });
  it("returns null for non-EDIFACT input", () => {
    expect(resolveRecipientFromEdifact("das ist kein edifact")).toBeNull();
  });
});

describe("findRelayTarget", () => {
  it("prefers an AS2-capable partner mailbox matched by GLN", async () => {
    await prisma.ediPartnerMailbox.create({
      data: {
        tenantId: T, name: "AS2 Partner", token: `edi_p_${crypto.randomBytes(10).toString("hex")}`,
        partnerGln: PARTNER_GLN, active: true,
        as2Id: "PARTNER-AS2", as2Url: "https://as2.partner.test/in", as2CertificatePem: "-----BEGIN CERTIFICATE-----X-----END CERTIFICATE-----",
      },
    });
    const target = await findRelayTarget(T, PARTNER_GLN);
    expect(target?.kind).toBe("as2");
    if (target?.kind === "as2") expect(target.as2.as2Id).toBe("PARTNER-AS2");
  });

  it("falls back to a supplier EDI url matched by channelConfig.partnerId", async () => {
    await prisma.supplier.create({
      data: { tenantId: T, name: "HTTP Partner", channel: "EDI", channelConfig: { partnerId: SUPP_GLN, url: "https://edi.supplier.test/in" } },
    });
    const target = await findRelayTarget(T, SUPP_GLN);
    expect(target?.kind).toBe("http");
    if (target?.kind === "http") expect(target.url).toBe("https://edi.supplier.test/in");
  });

  it("returns null for an unknown recipient", async () => {
    expect(await findRelayTarget(T, "0000000000000")).toBeNull();
  });
});

describe("relayOne (archival + routing, no network)", () => {
  it("archives SEND_FAILED when the recipient cannot be determined", async () => {
    const r = await sftpService.relayOne(T, null, Buffer.from("garbage"), "file1.edi");
    expect(r.ok).toBe(false);
    const m = await prisma.ediMessage.findUnique({ where: { id: r.messageId } });
    expect(m?.status).toBe("SEND_FAILED");
    expect(m?.error).toContain("Kein Empfänger");
  });

  it("archives SEND_FAILED when no partner matches the recipient GLN", async () => {
    const r = await sftpService.relayOne(T, "9999999999999", Buffer.from(INVOIC("9999999999999")), "file2.edi");
    expect(r.ok).toBe(false);
    const m = await prisma.ediMessage.findUnique({ where: { id: r.messageId } });
    expect(m?.status).toBe("SEND_FAILED");
    expect(m?.error).toContain("Kein Partner");
    expect(m?.type).toBe("INVOIC");
    expect(m?.documentNo).toBe("RE-2026-0001");
  });
});

afterAll(async () => {
  await prisma.ediMessage.deleteMany({ where: { tenantId: T } });
  await prisma.ediPartnerMailbox.deleteMany({ where: { tenantId: T } });
  await prisma.supplier.deleteMany({ where: { tenantId: T } });
  await prisma.$disconnect();
});
