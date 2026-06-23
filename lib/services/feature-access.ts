import type { UserRole } from "@/lib/auth/role";
import { FEATURES, defaultEnabled } from "@/lib/features";
import { featurePermissionRepo } from "@/lib/db/repos/feature-permission";

export type FeatureMap = Record<string, boolean>;

/**
 * Effective feature permissions for a user:
 *   per-user override  ??  per-role default  ??  built-in default (minRole).
 * GLOBAL_ADMIN always has every feature and cannot be restricted.
 */
export async function resolveUserFeatures(
  tenantId: string,
  userId: string,
  role: UserRole,
): Promise<FeatureMap> {
  if (role === "GLOBAL_ADMIN") {
    return Object.fromEntries(FEATURES.map((f) => [f.key, true]));
  }
  const [roleCfg, overrides] = await Promise.all([
    featurePermissionRepo.getRoleFeatures(tenantId, role),
    featurePermissionRepo.getUserOverrides(tenantId, userId),
  ]);
  const out: FeatureMap = {};
  for (const f of FEATURES) {
    out[f.key] = overrides[f.key] ?? roleCfg[f.key] ?? defaultEnabled(role, f.key);
  }
  return out;
}

/** Effective map for a role only (role default ?? built-in) — for the role-config UI. */
export function resolveRoleFeatures(role: UserRole, roleCfg: FeatureMap): FeatureMap {
  const out: FeatureMap = {};
  for (const f of FEATURES) out[f.key] = roleCfg[f.key] ?? defaultEnabled(role, f.key);
  return out;
}
