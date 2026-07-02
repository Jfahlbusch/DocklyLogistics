import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok, created, fail } from "@/lib/api/respond";
import { adminFeaturesRepo } from "@/lib/db/repos/admin-features";
import { isFeatureKey } from "@/lib/features";
import { FeatureProfileCreateSchema } from "@/lib/schemas/admin";

/** GET /api/v1/admin/feature-profiles — all profiles incl. usage count. */
export const GET = handler(async (req: NextRequest) => {
  await requireRoleFromHeaders(req.headers, "GLOBAL_ADMIN");
  return ok(await adminFeaturesRepo.listProfiles());
});

/** POST /api/v1/admin/feature-profiles — create a profile. */
export const POST = handler(async (req: NextRequest) => {
  await requireRoleFromHeaders(req.headers, "GLOBAL_ADMIN");
  const body = FeatureProfileCreateSchema.parse(await req.json());
  const features = Object.fromEntries(
    Object.entries(body.features).filter(([k]) => isFeatureKey(k)),
  );
  try {
    const profile = await adminFeaturesRepo.createProfile({
      name: body.name,
      description: body.description ?? null,
      features,
    });
    return created(profile);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail(409, "Name existiert", `Ein Profil namens „${body.name}“ gibt es bereits.`);
    }
    throw e;
  }
});
