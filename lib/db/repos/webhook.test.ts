import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import { deliveryRepo } from "./webhook";

const TENANT_ID = "test-webhook-requeue";

describe("deliveryRepo.requeue", () => {
  let webhookId = "";
  let givenUpId = "";
  let givenUpId2 = "";
  let successId = "";

  beforeAll(async () => {
    await prisma.tenant.upsert({
      where: { id: TENANT_ID },
      update: {},
      create: { id: TENANT_ID, name: TENANT_ID },
    });
    const wh = await prisma.webhook.create({
      data: {
        tenantId: TENANT_ID,
        url: "https://example.test/hook",
        events: ["order.sent"],
        secretEncrypted: "dummy",
        createdBy: "test",
      },
    });
    webhookId = wh.id;
    const mk = (status: string, extra: Record<string, unknown> = {}) =>
      prisma.webhookDelivery.create({
        data: { tenantId: TENANT_ID, webhookId, event: "order.sent", payload: {}, status, ...extra },
      });
    givenUpId = (await mk("GIVEN_UP", { attempts: 8, givenUpAt: new Date(), lastError: "boom" })).id;
    givenUpId2 = (await mk("GIVEN_UP", { attempts: 8, givenUpAt: new Date(), lastError: "boom" })).id;
    successId = (await mk("SUCCESS", { attempts: 1, succeededAt: new Date() })).id;
  });

  afterAll(async () => {
    await prisma.webhookDelivery.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.webhook.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
  });

  it("re-queues a GIVEN_UP delivery to PENDING with a fresh budget", async () => {
    const r = await prisma.$transaction((tx) =>
      deliveryRepo.requeue(tx, { tenantId: TENANT_ID, webhookId, deliveryId: givenUpId }),
    );
    expect(r.count).toBe(1);
    const d = await prisma.webhookDelivery.findUnique({ where: { id: givenUpId } });
    expect(d?.status).toBe("PENDING");
    expect(d?.givenUpAt).toBeNull();
    expect(d?.attempts).toBe(0);
    expect(d?.lastError).toBeNull();
  });

  it("does not requeue a SUCCESS delivery (status guard)", async () => {
    const r = await prisma.$transaction((tx) =>
      deliveryRepo.requeue(tx, { tenantId: TENANT_ID, webhookId, deliveryId: successId }),
    );
    expect(r.count).toBe(0);
  });

  it("does not requeue across tenants (isolation)", async () => {
    const r = await prisma.$transaction((tx) =>
      deliveryRepo.requeue(tx, { tenantId: "other-tenant", webhookId, deliveryId: givenUpId2 }),
    );
    expect(r.count).toBe(0);
    const d = await prisma.webhookDelivery.findUnique({ where: { id: givenUpId2 } });
    expect(d?.status).toBe("GIVEN_UP");
  });
});
