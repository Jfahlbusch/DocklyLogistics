import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { regenerateAutoSuggestions } from "@/lib/services/suggestion-engine";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok } from "@/lib/api/respond";

export const POST = handler(async (req: NextRequest) => {
  const ctx = requireRoleFromHeaders(req.headers, "USER");
  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";

  const result = await prisma.$transaction(async (tx) => {
    return regenerateAutoSuggestions(tx, ctx.tenantId, actorEmail);
  });
  return ok(result);
});
