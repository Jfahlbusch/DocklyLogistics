import type { NextRequest } from "next/server";
import { publicHandler } from "@/lib/api/public-handler";
import { PublicAuthError } from "@/lib/api/public-auth";
import { tenantEdiSettingsRepo } from "@/lib/db/repos/tenant-edi-settings";
import { ediService } from "@/lib/services/edi-service";
import { ok, fail } from "@/lib/api/respond";

/**
 * Per-tenant EDI mailbox: partners POST a raw EDIFACT interchange (text body)
 * to /api/edi/inbound/{token}. The token IS the auth (rotate under
 * Einstellungen → EDI). Always answers 202 on accepted payloads — processing
 * results live in the EDI monitor, matching classic mailbox semantics.
 */

const MAX_BYTES = 1_000_000; // 1 MB per interchange

type Ctx = { params: Promise<{ token: string }> };

export const POST = publicHandler(async (req: NextRequest, { params }: Ctx) => {
  const { token } = await params;
  const settings = await tenantEdiSettingsRepo.findByToken(token);
  if (!settings || !settings.inboundActive) {
    throw new PublicAuthError(401, "Unauthorized", "Unbekanntes oder deaktiviertes EDI-Postfach");
  }

  const raw = await req.text();
  if (!raw || raw.trim().length === 0) {
    return fail(422, "Leerer Payload", "EDIFACT-Inhalt fehlt im Request-Body");
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_BYTES) {
    return fail(413, "Payload zu groß", "Maximal 1 MB pro Interchange");
  }

  const result = await ediService.processInbound({
    tenantId: settings.tenantId,
    raw,
    transport: "inbound",
  });
  return ok(result, undefined, { status: 202 });
});
