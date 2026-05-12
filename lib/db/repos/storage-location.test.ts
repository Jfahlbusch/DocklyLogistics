import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db/client";
import { storageLocationRepo } from "./storage-location";

const TENANT_ID = "test-loc-tenant";

async function cleanup() {
  await prisma.storageLocation.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
}

beforeAll(async () => {
  await cleanup();
  await prisma.tenant.create({ data: { id: TENANT_ID, name: "test-loc" } });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.storageLocation.deleteMany({ where: { tenantId: TENANT_ID } });
});

describe("storageLocationRepo", () => {
  it("creates and finds by code", async () => {
    await prisma.$transaction(async (tx) => {
      await storageLocationRepo.create(tx, TENANT_ID, {
        code: "A-01-1", name: "Trockenlager A/Regal 1", zone: "Trocken", capacity: 40, active: true,
      });
    });
    const f = await storageLocationRepo.findByCode(TENANT_ID, "A-01-1");
    expect(f?.name).toBe("Trockenlager A/Regal 1");
  });

  it("filters by zone", async () => {
    await prisma.$transaction(async (tx) => {
      await storageLocationRepo.create(tx, TENANT_ID, { code: "A-1", name: "A", zone: "Trocken", active: true });
      await storageLocationRepo.create(tx, TENANT_ID, { code: "C-1", name: "C", zone: "Kühl", active: true });
    });
    const r = await storageLocationRepo.list({ tenantId: TENANT_ID, zone: "Kühl", page: 1, pageSize: 25 });
    expect(r.items.length).toBe(1);
    expect(r.items[0].code).toBe("C-1");
  });
});
