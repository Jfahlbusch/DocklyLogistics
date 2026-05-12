import type { NextRequest } from "next/server";
import { tenantChannelRepo } from "@/lib/db/repos/tenant-channel";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;
  const profile = await tenantChannelRepo.findById(ctx.tenantId, id);
  if (!profile) return fail(404, "Not Found");
  // Real dispatch comes in M4. In M2, we just confirm the profile exists.
  return ok({
    message: `Test-Versand für Kanal '${profile.channel}' ausgeführt (Mock in M2).`,
    channel: profile.channel,
    label: profile.label,
    tested_at: new Date().toISOString(),
  });
});
