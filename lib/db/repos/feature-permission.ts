import { prisma } from "@/lib/db/client";
import type { UserRole } from "@/lib/auth/role";

/** Stored feature permissions: per-role defaults and per-user overrides (tenant-scoped). */
export const featurePermissionRepo = {
  async getRoleFeatures(tenantId: string, role: UserRole): Promise<Record<string, boolean>> {
    const rows = await prisma.roleFeature.findMany({ where: { tenantId, role } });
    return Object.fromEntries(rows.map((r) => [r.featureKey, r.enabled]));
  },

  /** All role configs for a tenant: { role: { featureKey: enabled } }. */
  async getAllRoleFeatures(tenantId: string): Promise<Record<string, Record<string, boolean>>> {
    const rows = await prisma.roleFeature.findMany({ where: { tenantId } });
    const out: Record<string, Record<string, boolean>> = {};
    for (const r of rows) (out[r.role] ??= {})[r.featureKey] = r.enabled;
    return out;
  },

  async setRoleFeatures(tenantId: string, role: UserRole, entries: Record<string, boolean>) {
    await prisma.$transaction(
      Object.entries(entries).map(([featureKey, enabled]) =>
        prisma.roleFeature.upsert({
          where: { tenantId_role_featureKey: { tenantId, role, featureKey } },
          update: { enabled },
          create: { tenantId, role, featureKey, enabled },
        }),
      ),
    );
  },

  async getUserOverrides(tenantId: string, userId: string): Promise<Record<string, boolean>> {
    const rows = await prisma.userFeatureOverride.findMany({ where: { tenantId, userId } });
    return Object.fromEntries(rows.map((r) => [r.featureKey, r.enabled]));
  },

  /** Set one override; `value: null` clears it (falls back to the role default). */
  async setUserOverride(tenantId: string, userId: string, featureKey: string, value: boolean | null) {
    if (value === null) {
      await prisma.userFeatureOverride.deleteMany({ where: { tenantId, userId, featureKey } });
    } else {
      await prisma.userFeatureOverride.upsert({
        where: { tenantId_userId_featureKey: { tenantId, userId, featureKey } },
        update: { enabled: value },
        create: { tenantId, userId, featureKey, enabled: value },
      });
    }
  },
};
