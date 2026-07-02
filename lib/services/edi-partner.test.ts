import { describe, it, expect, afterAll } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/db/client";
import { ediService } from "./edi-service";
import { ediPartnerMailboxRepo } from "@/lib/db/repos/edi-partner-mailbox";

const T = `test-edipartner-${crypto.randomBytes(4).toString("hex")}`;
const ORDER_A = `TEST-PA-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
const ORDER_B = `TEST-PB-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
const GLN_PARTNER = "4012345000009";

function ordrsp(orderNo: string, senderGln = GLN_PARTNER): string {
  return (
    `UNB+UNOC:3+${senderGln}:14+4170000041474:14+260702:1200+ICP1'` +
    "UNH+MP1+ORDRSP:D:96A:UN'" +
    "BGM+231+AB-P-1+29'" +
    `RFF+ON:${orderNo}'` +
    "UNT+4+MP1'" +
    "UNZ+1+ICP1'"
  );
}

async function setup() {
  const supA = await prisma.supplier.create({
    data: { tenantId: T, name: "Partner A", channel: "EDI", channelConfig: {} },
  });
  const supB = await prisma.supplier.create({
    data: { tenantId: T, name: "Partner B", channel: "EDI", channelConfig: {} },
  });
  await prisma.order.create({
    data: { tenantId: T, orderNo: ORDER_A, supplierId: supA.id, status: "SENT", total: 0, createdBy: "test", sentAt: new Date() },
  });
  await prisma.order.create({
    data: { tenantId: T, orderNo: ORDER_B, supplierId: supB.id, status: "SENT", total: 0, createdBy: "test", sentAt: new Date() },
  });
  const mailbox = await ediPartnerMailboxRepo.create(T, {
    name: "Postfach Partner A",
    partnerGln: GLN_PARTNER,
    supplierId: supA.id,
  });
  return { supA, supB, mailbox };
}

describe("per-partner EDI mailboxes", () => {
  it("token lifecycle: create → findByToken → rotate → deactivate", async () => {
    const { mailbox } = await setup();
    expect(mailbox.token.startsWith("edi_p_")).toBe(true);
    expect((await ediPartnerMailboxRepo.findByToken(mailbox.token))?.id).toBe(mailbox.id);

    const rotated = await ediPartnerMailboxRepo.rotateToken(T, mailbox.id);
    expect(rotated!.token).not.toBe(mailbox.token);
    expect(await ediPartnerMailboxRepo.findByToken(mailbox.token)).toBeNull();

    await ediPartnerMailboxRepo.update(T, mailbox.id, { active: false });
    expect((await ediPartnerMailboxRepo.findInTenant(T, mailbox.id))?.active).toBe(false);
    await ediPartnerMailboxRepo.update(T, mailbox.id, { active: true });
  });

  it("confirms the bound supplier's order via the partner mailbox", async () => {
    const mailbox = (await ediPartnerMailboxRepo.list(T))[0];
    const r = await ediService.processInbound({
      tenantId: T,
      raw: ordrsp(ORDER_A),
      mailbox: { id: mailbox.id, name: mailbox.name, partnerGln: mailbox.partnerGln, supplierId: mailbox.supplierId },
    });
    expect(r.status).toBe("PROCESSED");
    const order = await prisma.order.findFirst({ where: { tenantId: T, orderNo: ORDER_A } });
    expect(order?.status).toBe("CONFIRMED");
    const msg = await prisma.ediMessage.findUnique({ where: { id: r.messageId } });
    expect(msg?.transport).toBe("inbound-partner");
    expect(msg?.supplierId).toBe(mailbox.supplierId);
    expect(msg?.createdBy).toBe(`mailbox:${mailbox.name}`);
  });

  it("rejects an ORDRSP for another supplier's order (binding)", async () => {
    const mailbox = (await ediPartnerMailboxRepo.list(T))[0];
    const r = await ediService.processInbound({
      tenantId: T,
      raw: ordrsp(ORDER_B),
      mailbox: { id: mailbox.id, name: mailbox.name, partnerGln: mailbox.partnerGln, supplierId: mailbox.supplierId },
    });
    expect(r.status).toBe("FAILED");
    expect(r.error).toContain("gehört nicht zum Partner");
    const order = await prisma.order.findFirst({ where: { tenantId: T, orderNo: ORDER_B } });
    expect(order?.status).toBe("SENT"); // unangetastet
  });

  it("rejects a wrong sender GLN when pinned", async () => {
    const mailbox = (await ediPartnerMailboxRepo.list(T))[0];
    const r = await ediService.processInbound({
      tenantId: T,
      raw: ordrsp(ORDER_A, "4999999999994"),
      mailbox: { id: mailbox.id, name: mailbox.name, partnerGln: mailbox.partnerGln, supplierId: mailbox.supplierId },
    });
    expect(r.status).toBe("FAILED");
    expect(r.error).toContain("Absender-GLN");
  });
});

afterAll(async () => {
  await prisma.$transaction([
    prisma.$executeRawUnsafe(`SET LOCAL session_replication_role = replica`),
    prisma.orderEvent.deleteMany({ where: { order: { tenantId: T } } }),
    prisma.auditLog.deleteMany({ where: { tenantId: T } }),
    prisma.order.deleteMany({ where: { tenantId: T } }),
  ]);
  await prisma.webhookDelivery.deleteMany({ where: { tenantId: T } });
  await prisma.notification.deleteMany({ where: { tenantId: T } });
  await prisma.ediMessage.deleteMany({ where: { tenantId: T } });
  await prisma.ediPartnerMailbox.deleteMany({ where: { tenantId: T } });
  await prisma.tenantEdiSettings.deleteMany({ where: { tenantId: T } });
  await prisma.supplier.deleteMany({ where: { tenantId: T } });
  await prisma.$disconnect();
});
