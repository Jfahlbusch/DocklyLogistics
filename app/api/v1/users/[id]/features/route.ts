import type { NextRequest } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";
import { userRepo } from "@/lib/db/repos/user";
import { featurePermissionRepo } from "@/lib/db/repos/feature-permission";
import { resolveUserFeatures, resolveRoleFeatures } from "@/lib/services/feature-access";
import { FEATURES, isFeatureKey } from "@/lib/features";

type Ctx = { params: Promise<{ id: string }> };

/** GET → registry + this user's effective map, role baseline, and current overrides. */
export const GET = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;
  const user = await userRepo.findInTenant(ctx.tenantId, id);
  if (!user) return fail(404, "Not Found");

  const [effective, overrides, roleCfg] = await Promise.all([
    resolveUserFeatures(ctx.tenantId, id, user.role),
    featurePermissionRepo.getUserOverrides(ctx.tenantId, id),
    featurePermissionRepo.getRoleFeatures(ctx.tenantId, user.role),
  ]);
  const roleDefault = resolveRoleFeatures(user.role, roleCfg);
  return ok({ user, features: FEATURES, effective, overrides, roleDefault });
});

const PutSchema = z.object({
  // featureKey -> true | false | null (null clears the override → back to the role default)
  overrides: z.record(z.string(), z.union([z.boolean(), z.null()])),
});

/** PUT { overrides } → set/clear per-user feature overrides. */
export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;
  const user = await userRepo.findInTenant(ctx.tenantId, id);
  if (!user) return fail(404, "Not Found");

  const body = PutSchema.parse(await req.json());
  for (const [key, value] of Object.entries(body.overrides)) {
    if (isFeatureKey(key)) await featurePermissionRepo.setUserOverride(ctx.tenantId, id, key, value);
  }
  const effective = await resolveUserFeatures(ctx.tenantId, id, user.role);
  return ok({ ok: true, effective });
});
