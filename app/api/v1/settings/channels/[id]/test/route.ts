import type { NextRequest } from "next/server";
import { tenantChannelRepo } from "@/lib/db/repos/tenant-channel";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";
import { sendTestEmail } from "@/lib/channels/email";
import { sendTestApi } from "@/lib/channels/api";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;
  const profile = await tenantChannelRepo.findById(ctx.tenantId, id);
  if (!profile) return fail(404, "Not Found");

  // EMAIL: real test send via the configured provider (Scaleway TEM → SMTP → mock).
  if (profile.channel === "EMAIL") {
    const body = (await req.json().catch(() => ({}))) as { to?: string };
    const result = await sendTestEmail(profile.config as Record<string, unknown>, body.to);
    if (!result.ok) return fail(422, "Test-Versand fehlgeschlagen", result.message);
    return ok({
      message: result.message,
      channel: "EMAIL",
      label: profile.label,
      tested_at: new Date().toISOString(),
      details: result.details,
    });
  }

  // API: connectivity ping (POST) to the configured callbackUrl.
  if (profile.channel === "API") {
    const result = await sendTestApi(profile.config as Record<string, unknown>, new Date().toISOString());
    if (!result.ok) return fail(422, "Test-Versand fehlgeschlagen", result.message);
    return ok({
      message: result.message,
      channel: "API",
      label: profile.label,
      tested_at: new Date().toISOString(),
      details: result.details,
    });
  }

  // EDI: a real test send (SFTP handshake) is not implemented yet.
  return ok({
    message: `Test-Versand für Kanal '${profile.channel}' ist noch nicht implementiert (aktuell EMAIL + API).`,
    channel: profile.channel,
    label: profile.label,
    tested_at: new Date().toISOString(),
  });
});
