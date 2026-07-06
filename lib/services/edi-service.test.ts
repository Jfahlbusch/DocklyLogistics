import { describe, it, expect, afterAll } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/db/client";
import { ediService } from "./edi-service";
import { tenantEdiSettingsRepo } from "@/lib/db/repos/tenant-edi-settings";

const T = `test-edi-${crypto.randomBytes(4).toString("hex")}`;
const ORDER_NO = `TEST-EDI-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
const EAN = "4099999000013";

function ordrspFor(orderNo: string, responseCode = "29"): string {
  return (
    "UNB+UNOC:3+4012345000009:14+4098765000004:14+260701:0800+ICR1'" +
    "UNH+MR1+ORDRSP:D:96A:UN'" +
    `BGM+231+CONF-1+${responseCode}'` +
    `RFF+ON:${orderNo}'` +
    "UNT+4+MR1'" +
    "UNZ+1+ICR1'"
  );
}

async function setup() {
  const supplier = await prisma.supplier.create({
    data: { tenantId: T, name: "EDI Test-Lieferant", channel: "EDI", channelConfig: {} },
  });
  const article = await prisma.article.create({
    data: {
      tenantId: T, sku: "TEST-MEHL-25", name: "Testmehl", eanGtin: EAN,
      baseUnit: "KG", orderUnit: "SACK", packFactor: 25,
    },
  });
  const order = await prisma.order.create({
    data: {
      tenantId: T, orderNo: ORDER_NO, supplierId: supplier.id,
      status: "SENT", total: 0, createdBy: "test", sentAt: new Date(),
    },
  });
  return { supplier, article, order };
}

describe("ediService inbound", () => {
  it("confirms the referenced order on ORDRSP (happy path), idempotent on replay", async () => {
    const { order } = await setup();

    const r1 = await ediService.processInbound({ tenantId: T, raw: ordrspFor(ORDER_NO) });
    expect(r1.status).toBe("PROCESSED");
    expect(r1.orderId).toBe(order.id);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated?.status).toBe("CONFIRMED");
    expect(updated?.confirmedAt).not.toBeNull();

    const msg = await prisma.ediMessage.findUnique({ where: { id: r1.messageId } });
    expect(msg?.direction).toBe("IN");
    expect(msg?.type).toBe("ORDRSP");
    expect(msg?.status).toBe("PROCESSED");
    expect(msg?.documentNo).toBeTruthy();

    // Replay of the same confirmation must not fail (already confirmed)
    const r2 = await ediService.processInbound({ tenantId: T, raw: ordrspFor(ORDER_NO) });
    expect(r2.status).toBe("PROCESSED");
    expect(r2.note).toBe("bereits bestätigt");

    const notif = await prisma.notification.findFirst({
      where: { tenantId: T, type: "edi.ordrsp.confirmed" },
    });
    expect(notif).not.toBeNull();
  });

  it("fails readable on unknown order reference", async () => {
    const r = await ediService.processInbound({ tenantId: T, raw: ordrspFor("GIBTS-NICHT-1") });
    expect(r.status).toBe("FAILED");
    expect(r.error).toContain("GIBTS-NICHT-1");
    const msg = await prisma.ediMessage.findUnique({ where: { id: r.messageId } });
    expect(msg?.status).toBe("FAILED");
  });

  it("stores inbound ORDERS with article matching by EAN", async () => {
    const raw =
      "UNB+UNOC:3+4111111000005:14+4098765000004:14+260701:0900+ICO1'" +
      "UNH+MO1+ORDERS:D:96A:UN'" +
      "BGM+220+KUNDE-2026-001+9'" +
      "DTM+137:20260701:102'" +
      "NAD+BY+4111111000005::9'" +
      "NAD+SU+4098765000004::9'" +
      "CUX+2:EUR:9'" +
      `LIN+1++${EAN}:EN'` +
      "QTY+21:12:SA'" +
      "PRI+AAA:17.5'" +
      "UNS+S'" +
      "CNT+2:1'" +
      "UNT+12+MO1'" +
      "UNZ+1+ICO1'";
    const r = await ediService.processInbound({ tenantId: T, raw });
    expect(r.status).toBe("PROCESSED");
    const msg = await prisma.ediMessage.findUnique({ where: { id: r.messageId } });
    expect(msg?.type).toBe("ORDERS");
    expect(msg?.documentNo).toBe("KUNDE-2026-001");
    const parsed = msg?.parsed as { lines: Array<{ articleId: string | null; qty: number }>; matchedLines: number };
    expect(parsed.matchedLines).toBe(1);
    expect(parsed.lines[0].articleId).not.toBeNull();
    expect(parsed.lines[0].qty).toBe(12);
  });

  it("marks a re-sent ORDERS with a known order number as DUPLICATE", async () => {
    const mk = (icRef: string, msgRef: string) =>
      `UNB+UNOC:3+4111111000005:14+4098765000004:14+260706:0900+${icRef}'` +
      `UNH+${msgRef}+ORDERS:D:96A:UN'` +
      "BGM+220+KUNDE-2026-777+9'" +
      "DTM+137:20260706:102'" +
      "NAD+BY+4111111000005::9'" +
      "NAD+SU+4098765000004::9'" +
      "CUX+2:EUR:9'" +
      `LIN+1++${EAN}:EN'` +
      "QTY+21:5:SA'" +
      "UNS+S'" +
      `UNT+10+${msgRef}'` +
      `UNZ+1+${icRef}'`;

    const first = await ediService.processInbound({ tenantId: T, raw: mk("ICD1", "MD1") });
    expect(first.status).toBe("PROCESSED");

    // Re-Send: neue Interchange-/Message-Referenzen, gleiche Bestellnummer.
    const second = await ediService.processInbound({ tenantId: T, raw: mk("ICD2", "MD2") });
    expect(second.status).toBe("DUPLICATE");
    expect(second.error).toContain("KUNDE-2026-777");

    const msg = await prisma.ediMessage.findUnique({ where: { id: second.messageId } });
    expect(msg?.status).toBe("DUPLICATE");
    // Die ursprüngliche Nachricht bleibt unangetastet PROCESSED.
    const orig = await prisma.ediMessage.findUnique({ where: { id: first.messageId } });
    expect(orig?.status).toBe("PROCESSED");
  });

  it("marks unparseable payloads FAILED without throwing", async () => {
    const r = await ediService.processInbound({ tenantId: T, raw: "   " });
    expect(r.status).toBe("FAILED");
    expect(r.error).toContain("parsebar");
  });

  it("reprocess turns a FAILED message PROCESSED once the order exists", async () => {
    const lateNo = `${ORDER_NO}-LATE`;
    const r1 = await ediService.processInbound({ tenantId: T, raw: ordrspFor(lateNo) });
    expect(r1.status).toBe("FAILED");

    const supplier = await prisma.supplier.findFirst({ where: { tenantId: T } });
    await prisma.order.create({
      data: {
        tenantId: T, orderNo: lateNo, supplierId: supplier!.id,
        status: "SENT", total: 0, createdBy: "test", sentAt: new Date(),
      },
    });
    const r2 = await ediService.reprocess(T, r1.messageId);
    expect(r2.status).toBe("PROCESSED");
  });

  it("rotateToken changes the mailbox address", async () => {
    const s1 = await tenantEdiSettingsRepo.ensure(T);
    const s2 = await tenantEdiSettingsRepo.rotateToken(T);
    expect(s2.inboundToken).not.toBe(s1.inboundToken);
    expect(s2.inboundToken.startsWith("edi_")).toBe(true);
    expect(await tenantEdiSettingsRepo.findByToken(s2.inboundToken)).not.toBeNull();
    expect(await tenantEdiSettingsRepo.findByToken(s1.inboundToken)).toBeNull();
  });
});

afterAll(async () => {
  // Append-only tables (OrderEvent/AuditLog) block UPDATE/DELETE via triggers.
  // SET LOCAL session_replication_role=replica skips them ONLY inside this
  // transaction/session — unlike ALTER TABLE … DISABLE TRIGGER it has zero
  // globally observable state, so parallel trigger-tests never flake.
  await prisma.$transaction([
    prisma.$executeRawUnsafe(`SET LOCAL session_replication_role = replica`),
    prisma.orderEvent.deleteMany({ where: { order: { tenantId: T } } }),
    prisma.auditLog.deleteMany({ where: { tenantId: T } }),
    prisma.order.deleteMany({ where: { tenantId: T } }), // events gone; cascades items
  ]);
  await prisma.webhookDelivery.deleteMany({ where: { tenantId: T } });
  await prisma.notification.deleteMany({ where: { tenantId: T } });
  await prisma.ediMessage.deleteMany({ where: { tenantId: T } });
  await prisma.article.deleteMany({ where: { tenantId: T } });
  await prisma.supplier.deleteMany({ where: { tenantId: T } });
  await prisma.tenantEdiSettings.deleteMany({ where: { tenantId: T } });
  await prisma.$disconnect();
});
