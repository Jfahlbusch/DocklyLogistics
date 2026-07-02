import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok, noContent, fail } from "@/lib/api/respond";
import { adminFeaturesRepo } from "@/lib/db/repos/admin-features";
import { isFeatureKey } from "@/lib/features";
import { FeatureProfileUpdateSchema } from "@/lib/schemas/admin";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/v1/admin/feature-profiles/{id} — rename/describe/refeature. */
export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  await requireRoleFromHeaders(req.headers, "GLOBAL_ADMIN");
  const { id } = await params;
  const existing = await adminFeaturesRepo.findProfile(id);
  if (!existing) return fail(404, "Nicht gefunden", "Funktionsprofil existiert nicht");

  const body = FeatureProfileUpdateSchema.parse(await req.json());
  const features = body.features
    ? Object.fromEntries(Object.entries(body.features).filter(([k]) => isFeatureKey(k)))
    : undefined;
  try {
    const updated = await adminFeaturesRepo.updateProfile(id, {
      name: body.name,
      description: body.description === undefined ? undefined : body.description,
      features,
    });
    return ok(updated);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail(409, "Name existiert", "Ein Profil mit diesem Namen gibt es bereits.");
    }
    throw e;
  }
});

/** DELETE /api/v1/admin/feature-profiles/{id} — assigned tenants fall back to everything-on. */
export const DELETE = handler(async (req: NextRequest, { params }: Ctx) => {
  await requireRoleFromHeaders(req.headers, "GLOBAL_ADMIN");
  const { id } = await params;
  const existing = await adminFeaturesRepo.findProfile(id);
  if (!existing) return fail(404, "Nicht gefunden", "Funktionsprofil existiert nicht");
  await adminFeaturesRepo.deleteProfile(id);
  return noContent();
});
