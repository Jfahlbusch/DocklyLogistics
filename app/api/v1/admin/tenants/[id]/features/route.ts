import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";
import { adminFeaturesRepo } from "@/lib/db/repos/admin-features";
import { resolveTenantFeatures } from "@/lib/services/feature-access";
import { FEATURES, isFeatureKey } from "@/lib/features";
import { AdminTenantFeaturesUpdateSchema } from "@/lib/schemas/admin";

type Ctx = { params: Promise<{ id: string }> };

// GLOBAL_ADMIN-only features are pointless on a tenant gate (the operator is
// immune) — keep them out of the admin matrix.
const GATEABLE = FEATURES.filter((f) => f.minRole !== "GLOBAL_ADMIN");

async function view(tenantId: string) {
  const gateData = await adminFeaturesRepo.getTenantGateData(tenantId);
  return {
    profile: gateData.profile,
    overrides: gateData.overrides,
    profileFeatures: gateData.profileFeatures,
    effective: resolveTenantFeatures(gateData),
    features: GATEABLE.map(({ key, label, group }) => ({ key, label, group })),
  };
}

/** GET /api/v1/admin/tenants/{id}/features — gate data for one tenant. */
export const GET = handler(async (req: NextRequest, { params }: Ctx) => {
  await requireRoleFromHeaders(req.headers, "GLOBAL_ADMIN");
  const { id } = await params;
  const tenant = await adminFeaturesRepo.findTenant(id);
  if (!tenant) return fail(404, "Nicht gefunden", "Tenant existiert nicht");
  return ok({ tenant: { id: tenant.id, name: tenant.name }, ...(await view(id)) });
});

/** PUT /api/v1/admin/tenants/{id}/features — set overrides and/or assign profile. */
export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  await requireRoleFromHeaders(req.headers, "GLOBAL_ADMIN");
  const { id } = await params;
  const tenant = await adminFeaturesRepo.findTenant(id);
  if (!tenant) return fail(404, "Nicht gefunden", "Tenant existiert nicht");

  const body = AdminTenantFeaturesUpdateSchema.parse(await req.json());

  if (body.profileId !== undefined) {
    if (body.profileId !== null) {
      const profile = await adminFeaturesRepo.findProfile(body.profileId);
      if (!profile) return fail(404, "Nicht gefunden", "Funktionsprofil existiert nicht");
    }
    await adminFeaturesRepo.setTenantProfile(id, body.profileId);
  }
  if (body.features) {
    const entries = Object.fromEntries(
      Object.entries(body.features).filter(([k]) => isFeatureKey(k)),
    );
    await adminFeaturesRepo.setTenantFeatures(id, entries);
  }
  return ok({ tenant: { id: tenant.id, name: tenant.name }, ...(await view(id)) });
});
