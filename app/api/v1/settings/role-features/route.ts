import type { NextRequest } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok } from "@/lib/api/respond";
import { featurePermissionRepo } from "@/lib/db/repos/feature-permission";
import { FEATURES, CONFIGURABLE_ROLES, isFeatureKey } from "@/lib/features";
import { resolveRoleFeatures } from "@/lib/services/feature-access";

/** GET → the feature registry + the effective default map for each configurable role. */
export const GET = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const all = await featurePermissionRepo.getAllRoleFeatures(ctx.tenantId);
  const roles: Record<string, Record<string, boolean>> = {};
  for (const role of CONFIGURABLE_ROLES) roles[role] = resolveRoleFeatures(role, all[role] ?? {});
  return ok({ features: FEATURES, roles });
});

const PutSchema = z.object({
  role: z.enum(["MANAGER", "USER"]),
  features: z.record(z.string(), z.boolean()),
});

/** PUT { role, features } → store role defaults (unknown feature keys are ignored). */
export const PUT = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const body = PutSchema.parse(await req.json());
  const entries = Object.fromEntries(Object.entries(body.features).filter(([k]) => isFeatureKey(k)));
  await featurePermissionRepo.setRoleFeatures(ctx.tenantId, body.role, entries);
  return ok({ ok: true });
});
