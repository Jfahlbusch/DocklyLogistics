import type { NextRequest } from "next/server";
import { tenantChannelRepo } from "@/lib/db/repos/tenant-channel";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";
import { sendTestEmail } from "@/lib/channels/email";
import { sendTestApi } from "@/lib/channels/api";
import { sendTestEdi } from "@/lib/channels/edi";

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

  // EDI: generate a self-addressed test ORDERS and run it through the real
  // inbound pipeline (loopback) — visible afterwards in the EDI monitor.
  const result = await sendTestEdi(ctx.tenantId, profile.config as Record<string, unknown>);
  if (!result.ok) return fail(422, "Test-Versand fehlgeschlagen", result.message);
  return ok({
    message: result.message,
    channel: "EDI",
    label: profile.label,
    tested_at: new Date().toISOString(),
    details: result.details,
  });
});
