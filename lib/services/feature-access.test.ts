import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import { featurePermissionRepo } from "@/lib/db/repos/feature-permission";
import { resolveUserFeatures } from "./feature-access";

const T = "test-featperm";
const U = "test-featperm-user";

async function cleanup() {
  await prisma.roleFeature.deleteMany({ where: { tenantId: T } });
  await prisma.userFeatureOverride.deleteMany({ where: { tenantId: T } });
  await prisma.tenant.deleteMany({ where: { id: T } });
}

describe("resolveUserFeatures", () => {
  beforeAll(async () => {
    await cleanup();
    await prisma.tenant.create({ data: { id: T, name: T } });
  });
  afterAll(cleanup);

  it("GLOBAL_ADMIN gets every feature", async () => {
    const f = await resolveUserFeatures(T, U, "GLOBAL_ADMIN");
    expect(Object.values(f).every(Boolean)).toBe(true);
    expect(f["settings.users"]).toBe(true);
  });

  it("uses built-in defaults when nothing is configured", async () => {
    const f = await resolveUserFeatures(T, U, "USER");
    expect(f["dashboard"]).toBe(true);
    expect(f["orders.create"]).toBe(true);
    expect(f["audit"]).toBe(false); // minRole MANAGER
    expect(f["orders.send"]).toBe(false); // minRole MANAGER
  });

  it("role default overrides built-in, user override wins over role default", async () => {
    await featurePermissionRepo.setRoleFeatures(T, "USER", { audit: true, "orders.send": true });
    let f = await resolveUserFeatures(T, U, "USER");
    expect(f["audit"]).toBe(true);
    expect(f["orders.send"]).toBe(true);

    await featurePermissionRepo.setUserOverride(T, U, "audit", false);
    f = await resolveUserFeatures(T, U, "USER");
    expect(f["audit"]).toBe(false); // override wins
    expect(f["orders.send"]).toBe(true); // role default still applies

    await featurePermissionRepo.setUserOverride(T, U, "audit", null);
    f = await resolveUserFeatures(T, U, "USER");
    expect(f["audit"]).toBe(true); // back to role default
  });
});
