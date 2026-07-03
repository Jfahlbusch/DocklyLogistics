import { describe, it, expect, afterAll } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/db/client";
import { as2Service } from "./as2-service";

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
});

afterAll(async () => {
  await prisma.as2InboundReceipt.deleteMany({ where: { tenantId: T } });
  await prisma.tenantEdiSettings.deleteMany({ where: { tenantId: T } });
  await prisma.tenant.deleteMany({ where: { id: T } });
  await prisma.$disconnect();
});
