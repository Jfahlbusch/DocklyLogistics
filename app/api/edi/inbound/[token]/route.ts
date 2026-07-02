import type { NextRequest } from "next/server";
import { publicHandler } from "@/lib/api/public-handler";
import { PublicAuthError } from "@/lib/api/public-auth";
import { tenantEdiSettingsRepo } from "@/lib/db/repos/tenant-edi-settings";
import { ediPartnerMailboxRepo } from "@/lib/db/repos/edi-partner-mailbox";
import { ediService, type MailboxContext } from "@/lib/services/edi-service";
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

  // Two mailbox kinds share this endpoint: the tenant-wide token (edi_…) and
  // per-partner tokens (edi_p_…) with sender/supplier binding.
  let tenantId: string;
  let mailbox: MailboxContext | undefined;
  const settings = await tenantEdiSettingsRepo.findByToken(token);
  if (settings) {
    if (!settings.inboundActive) {
      throw new PublicAuthError(401, "Unauthorized", "Unbekanntes oder deaktiviertes EDI-Postfach");
    }
    tenantId = settings.tenantId;
  } else {
    const partner = await ediPartnerMailboxRepo.findByToken(token);
    if (!partner || !partner.active) {
      throw new PublicAuthError(401, "Unauthorized", "Unbekanntes oder deaktiviertes EDI-Postfach");
    }
    tenantId = partner.tenantId;
    mailbox = {
      id: partner.id,
      name: partner.name,
      partnerGln: partner.partnerGln,
      supplierId: partner.supplierId,
    };
    ediPartnerMailboxRepo.touchLastUsed(partner.id).catch(() => {});
  }

  const raw = await req.text();
  if (!raw || raw.trim().length === 0) {
    return fail(422, "Leerer Payload", "EDIFACT-Inhalt fehlt im Request-Body");
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_BYTES) {
    return fail(413, "Payload zu groß", "Maximal 1 MB pro Interchange");
  }

  const result = await ediService.processInbound({ tenantId, raw, mailbox });
  return ok(result, undefined, { status: 202 });
});
