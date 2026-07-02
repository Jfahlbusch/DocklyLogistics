import type { UserRole } from "@/lib/auth/role";
import { FEATURES, defaultEnabled } from "@/lib/features";
import { featurePermissionRepo } from "@/lib/db/repos/feature-permission";
import { adminFeaturesRepo, type TenantGateData } from "@/lib/db/repos/admin-features";

export type FeatureMap = Record<string, boolean>;

/**
 * Tenant-level gate set by the operator (GLOBAL_ADMIN):
 *   tenant override  ??  assigned profile  ??  true (everything available).
 * A `false` here wins over any role default or user override.
 */
export function resolveTenantFeatures(gate: TenantGateData): FeatureMap {
  const out: FeatureMap = {};
  for (const f of FEATURES) {
    out[f.key] = gate.overrides[f.key] ?? gate.profileFeatures?.[f.key] ?? true;
  }
  return out;
}

/**
 * Effective feature permissions for a user:
 *   tenant gate (operator)  →  per-user override  ??  per-role default  ??  built-in default.
 * GLOBAL_ADMIN always has every feature and cannot be restricted (not even by
 * the tenant gate — the operator must never lock themselves out of /admin).
 */
export async function resolveUserFeatures(
  tenantId: string,
  userId: string,
  role: UserRole,
): Promise<FeatureMap> {
  if (role === "GLOBAL_ADMIN") {
    return Object.fromEntries(FEATURES.map((f) => [f.key, true]));
  }
  const [roleCfg, overrides, gateData] = await Promise.all([
    featurePermissionRepo.getRoleFeatures(tenantId, role),
    featurePermissionRepo.getUserOverrides(tenantId, userId),
    adminFeaturesRepo.getTenantGateData(tenantId),
  ]);
  const gate = resolveTenantFeatures(gateData);
  const out: FeatureMap = {};
  for (const f of FEATURES) {
    out[f.key] =
      gate[f.key] === false
        ? false
        : (overrides[f.key] ?? roleCfg[f.key] ?? defaultEnabled(role, f.key));
  }
  return out;
}

/** Effective map for a role only (role default ?? built-in) — for the role-config UI. */
export function resolveRoleFeatures(role: UserRole, roleCfg: FeatureMap): FeatureMap {
  const out: FeatureMap = {};
  for (const f of FEATURES) out[f.key] = roleCfg[f.key] ?? defaultEnabled(role, f.key);
  return out;
}
