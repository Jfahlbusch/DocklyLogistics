import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";

/**
 * Operator-level feature administration (GLOBAL_ADMIN only). This repo is the
 * ONE sanctioned cross-tenant surface — every caller must sit behind a
 * requireRoleFromHeaders(headers, "GLOBAL_ADMIN") guard.
 */

export type FeatureBoolMap = Record<string, boolean>;

export type TenantGateData = {
  /** Per-tenant operator overrides (featureKey → enabled). */
  overrides: FeatureBoolMap;
  /** Assigned profile's feature map, if any. */
  profileFeatures: FeatureBoolMap | null;
  profile: { id: string; name: string } | null;
};

export const adminFeaturesRepo = {
  /* ---------- tenants ---------- */

  async listTenants() {
    const tenants = await prisma.tenant.findMany({
      orderBy: { name: "asc" },
      include: {
        featureProfile: { select: { id: true, name: true } },
        _count: { select: { users: true } },
      },
    });
    const overrides = await prisma.tenantFeature.groupBy({
      by: ["tenantId", "enabled"],
      _count: { _all: true },
    });
    const byTenant = new Map<string, { on: number; off: number }>();
    for (const o of overrides) {
      const e = byTenant.get(o.tenantId) ?? { on: 0, off: 0 };
      if (o.enabled) e.on += o._count._all;
      else e.off += o._count._all;
      byTenant.set(o.tenantId, e);
    }
    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      users: t._count.users,
      profile: t.featureProfile,
      overridesOn: byTenant.get(t.id)?.on ?? 0,
      overridesOff: byTenant.get(t.id)?.off ?? 0,
      createdAt: t.createdAt,
    }));
  },

  findTenant(tenantId: string) {
    return prisma.tenant.findUnique({ where: { id: tenantId } });
  },

  /** Raw gate data for one tenant — input for the effective resolution. */
  async getTenantGateData(tenantId: string): Promise<TenantGateData> {
    const [tenant, rows] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { featureProfile: { select: { id: true, name: true, features: true } } },
      }),
      prisma.tenantFeature.findMany({ where: { tenantId } }),
    ]);
    return {
      overrides: Object.fromEntries(rows.map((r) => [r.featureKey, r.enabled])),
      profileFeatures: (tenant?.featureProfile?.features as FeatureBoolMap | undefined) ?? null,
      profile: tenant?.featureProfile
        ? { id: tenant.featureProfile.id, name: tenant.featureProfile.name }
        : null,
    };
  },

  /** Set operator overrides; `null` clears one (falls back to profile/default). */
  async setTenantFeatures(tenantId: string, entries: Record<string, boolean | null>) {
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const [featureKey, value] of Object.entries(entries)) {
      if (value === null) {
        ops.push(prisma.tenantFeature.deleteMany({ where: { tenantId, featureKey } }));
      } else {
        ops.push(
          prisma.tenantFeature.upsert({
            where: { tenantId_featureKey: { tenantId, featureKey } },
            update: { enabled: value },
            create: { tenantId, featureKey, enabled: value },
          }),
        );
      }
    }
    if (ops.length) await prisma.$transaction(ops);
  },

  setTenantProfile(tenantId: string, featureProfileId: string | null) {
    return prisma.tenant.update({ where: { id: tenantId }, data: { featureProfileId } });
  },

  /* ---------- profiles ---------- */

  async listProfiles() {
    const rows = await prisma.featureProfile.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { tenants: true } } },
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      features: p.features as FeatureBoolMap,
      tenants: p._count.tenants,
      updatedAt: p.updatedAt,
    }));
  },

  findProfile(id: string) {
    return prisma.featureProfile.findUnique({ where: { id } });
  },

  createProfile(data: { name: string; description?: string | null; features: FeatureBoolMap }) {
    return prisma.featureProfile.create({
      data: { name: data.name, description: data.description ?? null, features: data.features },
    });
  },

  updateProfile(
    id: string,
    data: { name?: string; description?: string | null; features?: FeatureBoolMap },
  ) {
    return prisma.featureProfile.update({ where: { id }, data });
  },

  /** Delete a profile — assigned tenants fall back to "everything on" (FK SetNull). */
  deleteProfile(id: string) {
    return prisma.featureProfile.delete({ where: { id } });
  },
};
