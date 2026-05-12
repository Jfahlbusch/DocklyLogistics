import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db/client";
import { tenantChannelRepo } from "./tenant-channel";

const TENANT_ID = "test-tcc-tenant";

async function cleanup() {
  await prisma.tenantChannelConfig.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
}

beforeAll(async () => {
  await cleanup();
  await prisma.tenant.create({ data: { id: TENANT_ID, name: "test-tcc" } });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.tenantChannelConfig.deleteMany({ where: { tenantId: TENANT_ID } });
});

describe("tenantChannelRepo isDefault enforcement", () => {
  it("creates a profile and finds default", async () => {
    await prisma.$transaction(async (tx) => {
      await tenantChannelRepo.create(tx, TENANT_ID, {
        channel: "EMAIL", isDefault: true, active: true, label: "main",
        config: { fromEmail: "x@y.de", fromName: "X" },
      });
    });
    const def = await tenantChannelRepo.findDefault(TENANT_ID, "EMAIL");
    expect(def?.label).toBe("main");
  });

  it("creating a second default flips the first", async () => {
    await prisma.$transaction(async (tx) => {
      await tenantChannelRepo.create(tx, TENANT_ID, {
        channel: "EMAIL", isDefault: true, active: true, label: "primary",
        config: { fromEmail: "a@y.de", fromName: "A" },
      });
    });
    await prisma.$transaction(async (tx) => {
      await tenantChannelRepo.create(tx, TENANT_ID, {
        channel: "EMAIL", isDefault: true, active: true, label: "secondary",
        config: { fromEmail: "b@y.de", fromName: "B" },
      });
    });
    const { items } = await tenantChannelRepo.list({ tenantId: TENANT_ID, page: 1, pageSize: 25 });
    const defaults = items.filter((p) => p.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].label).toBe("secondary");
  });

  it("isolates between channels (EMAIL and API can both have a default)", async () => {
    await prisma.$transaction(async (tx) => {
      await tenantChannelRepo.create(tx, TENANT_ID, {
        channel: "EMAIL", isDefault: true, active: true, label: "email-main",
        config: { fromEmail: "x@y.de", fromName: "X" },
      });
      await tenantChannelRepo.create(tx, TENANT_ID, {
        channel: "API", isDefault: true, active: true, label: "api-main",
        config: { callbackUrl: "https://example.com/cb" },
      });
    });
    const emailDef = await tenantChannelRepo.findDefault(TENANT_ID, "EMAIL");
    const apiDef = await tenantChannelRepo.findDefault(TENANT_ID, "API");
    expect(emailDef?.label).toBe("email-main");
    expect(apiDef?.label).toBe("api-main");
  });
});
