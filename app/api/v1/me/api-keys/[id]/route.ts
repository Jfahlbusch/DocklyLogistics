import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { noContent, fail } from "@/lib/api/respond";
import { auth } from "@/lib/auth";
import { userApiKeyRepo } from "@/lib/db/repos/user-api-key";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /api/v1/me/api-keys/{id} — revoke one of the caller's own keys. */
export const DELETE = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const userId = (session.user as { id?: string }).id ?? session.user.email ?? "unknown";
  const { id } = await params;

  const r = await userApiKeyRepo.revoke(ctx.tenantId, userId, id);
  if (r.count === 0) return fail(404, "API-Key nicht gefunden");
  return noContent();
});
