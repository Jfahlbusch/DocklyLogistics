import { describe, it, expect, afterAll } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/db/client";
import { sendTestEdi } from "./edi";
import { tenantEdiSettingsRepo } from "@/lib/db/repos/tenant-edi-settings";

const T = `test-editest-${crypto.randomBytes(4).toString("hex")}`;
const CFG = { senderId: "4170000041474", senderQualifier: "14", edifactVersion: "D.96A" };

describe("sendTestEdi (profile loopback test)", () => {
  it("rejects an incomplete profile", async () => {
    const r = await sendTestEdi(T, { senderId: "x" });
    expect(r.ok).toBe(false);
    expect(r.message).toContain("unvollständig");
  });

  it("generates, loops back through inbound processing and archives the message", async () => {
    const r = await sendTestEdi(T, CFG);
    expect(r.ok).toBe(true);
    expect(r.details?.messageId).toBeTruthy();

    const msg = await prisma.ediMessage.findUnique({ where: { id: r.details!.messageId as string } });
    expect(msg?.tenantId).toBe(T);
    expect(msg?.direction).toBe("IN");
    expect(msg?.type).toBe("ORDERS");
    expect(msg?.status).toBe("PROCESSED");
    expect(msg?.transport).toBe("test-loopback");
    expect(msg?.documentNo).toMatch(/^TEST-/);
  });

  it("skips loopback delivery when the mailbox is inactive but still validates", async () => {
    await tenantEdiSettingsRepo.update(T, { inboundActive: false });
    const r = await sendTestEdi(T, CFG);
    expect(r.ok).toBe(true);
    expect(r.message).toContain("deaktiviert");
    expect(r.details?.messageId).toBeUndefined();
  });
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { tenantId: T } });
  await prisma.ediMessage.deleteMany({ where: { tenantId: T } });
  await prisma.tenantEdiSettings.deleteMany({ where: { tenantId: T } });
  await prisma.$disconnect();
});
