import { describe, it, expect, afterAll } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/db/client";
import { adminFeaturesRepo } from "./admin-features";
import { featurePermissionRepo } from "./feature-permission";
import { resolveUserFeatures, resolveTenantFeatures } from "@/lib/services/feature-access";

const T = `test-adminfeat-${crypto.randomBytes(4).toString("hex")}`;
const PROFILE = `Test-Profil-${crypto.randomBytes(4).toString("hex")}`;

describe("operator feature gate (profiles + tenant overrides)", () => {
  it("tenant gate resolves override ?? profile ?? true", async () => {
    await prisma.tenant.create({ data: { id: T, name: T } });
    const profile = await adminFeaturesRepo.createProfile({
      name: PROFILE,
      description: "EDI aus, Rest an",
      features: { edi: false, "edi.manage": false },
    });
    await adminFeaturesRepo.setTenantProfile(T, profile.id);

    const gate = resolveTenantFeatures(await adminFeaturesRepo.getTenantGateData(T));
    expect(gate.edi).toBe(false);          // vom Profil gesperrt
    expect(gate.articles).toBe(true);      // Profil schweigt → Standard an

    // Tenant-Override schlägt das Profil
    await adminFeaturesRepo.setTenantFeatures(T, { edi: true });
    const gate2 = resolveTenantFeatures(await adminFeaturesRepo.getTenantGateData(T));
    expect(gate2.edi).toBe(true);

    // null räumt den Override → zurück zum Profil
    await adminFeaturesRepo.setTenantFeatures(T, { edi: null });
    const gate3 = resolveTenantFeatures(await adminFeaturesRepo.getTenantGateData(T));
    expect(gate3.edi).toBe(false);
  });

  it("tenant gate beats role defaults and user overrides", async () => {
    // MANAGER hätte edi per Rolle; User-Override sagt sogar explizit true
    await featurePermissionRepo.setUserOverride(T, "user-1", "edi", true);
    const effective = await resolveUserFeatures(T, "user-1", "MANAGER");
    expect(effective.edi).toBe(false); // Betreiber-Sperre gewinnt
    expect(effective.articles).toBe(true);
  });

  it("GLOBAL_ADMIN is immune to the gate", async () => {
    const effective = await resolveUserFeatures(T, "admin-1", "GLOBAL_ADMIN");
    expect(effective.edi).toBe(true);
    expect(effective.admin).toBe(true);
  });

  it("deleting an assigned profile falls back to everything-on (SetNull)", async () => {
    const p = await prisma.featureProfile.findUnique({ where: { name: PROFILE } });
    await adminFeaturesRepo.deleteProfile(p!.id);
    const tenant = await prisma.tenant.findUnique({ where: { id: T } });
    expect(tenant?.featureProfileId).toBeNull();
    // edi-Override wurde in Test 1 geräumt, Profil ist weg → alles wieder an
    const gate = resolveTenantFeatures(await adminFeaturesRepo.getTenantGateData(T));
    expect(gate.edi).toBe(true);
  });

  it("gate without profile and without overrides is everything-on", async () => {
    await adminFeaturesRepo.setTenantFeatures(T, { edi: null });
    const gate = resolveTenantFeatures(await adminFeaturesRepo.getTenantGateData(T));
    expect(gate.edi).toBe(true);
    expect(gate.orders).toBe(true);
  });

  it("listTenants reports profile and override counts", async () => {
    await adminFeaturesRepo.setTenantFeatures(T, { webhooks: false, reports: false });
    const rows = await adminFeaturesRepo.listTenants();
    const mine = rows.find((r) => r.id === T);
    expect(mine).toBeTruthy();
    expect(mine!.overridesOff).toBe(2);
    expect(mine!.profile).toBeNull();
  });
});

afterAll(async () => {
  await prisma.tenantFeature.deleteMany({ where: { tenantId: T } });
  await prisma.userFeatureOverride.deleteMany({ where: { tenantId: T } });
  await prisma.tenant.deleteMany({ where: { id: T } });
  await prisma.featureProfile.deleteMany({ where: { name: PROFILE } });
  await prisma.$disconnect();
});
