import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { encryptSecret, decryptSecret } from "@/lib/crypto/aes";
import {
  generateAs2Identity,
  certificateFingerprint,
  verifySignedMime,
  decryptMime,
  buildSignedMdn,
  type MdnDisposition,
} from "@/lib/edi/as2";
import { ediService } from "@/lib/services/edi-service";
import { tenantEdiSettingsRepo } from "@/lib/db/repos/tenant-edi-settings";

/**
 * AS2 identity + inbound handling per tenant. The private key is stored
 * AES-encrypted (APP_KEY) like webhook secrets; it never leaves the server.
 */

export type As2IdentityView = {
  as2Id: string;
  certificatePem: string;
  fingerprintSha256: string;
  endpointPath: string; // /api/edi/as2
};

export const as2Service = {
  /** Current identity (without private key) or null if not generated yet. */
  async getIdentity(tenantId: string): Promise<As2IdentityView | null> {
    const s = await tenantEdiSettingsRepo.get(tenantId);
    if (!s?.as2Id || !s.as2CertificatePem) return null;
    return {
      as2Id: s.as2Id,
      certificatePem: s.as2CertificatePem,
      fingerprintSha256: certificateFingerprint(s.as2CertificatePem),
      endpointPath: "/api/edi/as2",
    };
  },

  /** Generate (or regenerate) the tenant's AS2 identity. */
  async generateIdentity(tenantId: string, as2Id?: string): Promise<As2IdentityView> {
    await tenantEdiSettingsRepo.ensure(tenantId);
    const existing = await tenantEdiSettingsRepo.get(tenantId);
    const finalId =
      (as2Id && as2Id.trim()) ||
      existing?.as2Id ||
      tenantId.toUpperCase().replace(/[^A-Z0-9-]/g, "-");
    const identity = generateAs2Identity(finalId);
    await prisma.tenantEdiSettings.update({
      where: { tenantId },
      data: {
        as2Id: finalId,
        as2PrivateKeyEncrypted: encryptSecret(identity.privateKeyPem),
        as2CertificatePem: identity.certificatePem,
      },
    });
    return {
      as2Id: finalId,
      certificatePem: identity.certificatePem,
      fingerprintSha256: certificateFingerprint(identity.certificatePem),
      endpointPath: "/api/edi/as2",
    };
  },

  /** Full identity incl. decrypted private key — server-internal only. */
  async getSigningIdentity(tenantId: string) {
    const s = await tenantEdiSettingsRepo.get(tenantId);
    if (!s?.as2Id || !s.as2CertificatePem || !s.as2PrivateKeyEncrypted) return null;
    return {
      as2Id: s.as2Id,
      certificatePem: s.as2CertificatePem,
      privateKeyPem: decryptSecret(s.as2PrivateKeyEncrypted),
    };
  },

  /**
   * Handle an inbound AS2 POST. Returns the HTTP response to send: either a
   * signed synchronous MDN (200) or a plain error (4xx) when we cannot even
   * address a signed answer (unknown AS2-To → no identity to sign with).
   */
  async processInbound(args: {
    headers: { as2From: string | null; as2To: string | null; messageId: string | null; contentType: string | null };
    rawBody: string;
  }): Promise<
    | { kind: "plain"; status: number; message: string }
    | { kind: "mdn"; status: number; body: string; contentType: string; as2From: string; as2To: string }
  > {
    const { as2From, as2To, messageId, contentType } = args.headers;
    if (!as2From || !as2To) {
      return { kind: "plain", status: 400, message: "AS2-From/AS2-To-Header fehlen" };
    }

    // AS2-IDs are matched case-insensitively (a common onboarding pitfall);
    // trust still rests on the certificate signature verified further down.
    const settings = await prisma.tenantEdiSettings.findFirst({
      where: { as2Id: { equals: as2To, mode: "insensitive" } },
    });
    if (!settings || !settings.as2PrivateKeyEncrypted || !settings.as2CertificatePem) {
      return { kind: "plain", status: 403, message: `Unbekannte AS2-Empfänger-Kennung ${as2To}` };
    }
    const tenantId = settings.tenantId;
    const identity = {
      certificatePem: settings.as2CertificatePem,
      privateKeyPem: decryptSecret(settings.as2PrivateKeyEncrypted),
    };
    const originalMessageId = messageId ?? `<unknown-${crypto.randomBytes(6).toString("hex")}>`;

    const mdn = (disposition: MdnDisposition, mic: string | null) => {
      const built = buildSignedMdn({
        originalMessageId,
        as2From: as2To, // we answer as the recipient identity
        as2To: as2From,
        micBase64: mic,
        disposition,
        signer: identity,
      });
      return {
        kind: "mdn" as const,
        status: 200,
        body: built.body,
        contentType: built.contentType,
        as2From: as2To,
        as2To: as2From,
      };
    };

    // Partner lookup by AS2-ID within this tenant.
    const mailbox = await prisma.ediPartnerMailbox.findFirst({
      where: { tenantId, as2Id: { equals: as2From, mode: "insensitive" } },
    });
    if (!mailbox || !mailbox.active) {
      const err = `Unbekannter oder gesperrter AS2-Partner ${as2From}`;
      console.warn(`[as2-inbound-fail] from=${as2From} to=${as2To} error=${err}`);
      await prisma.ediMessage
        .create({ data: { tenantId, direction: "IN", type: "AS2", status: "FAILED", transport: "as2", payload: args.rawBody, createdBy: "as2-inbound", error: err } })
        .catch(() => {});
      return mdn({ processed: false, error: err }, null);
    }
    if (!mailbox.as2CertificatePem) {
      return mdn({ processed: false, error: `Für Partner „${mailbox.name}“ ist kein Zertifikat hinterlegt` }, null);
    }

    // Replay protection: the unique (tenantId, messageId) row is the atomic
    // dedupe. A real Message-ID that we've already accepted → duplicate MDN,
    // no reprocessing. Rolled back below if processing fails, so a corrected
    // resend (same ID) still works. Messages without an ID can't be deduped.
    const hasRealId = !!messageId;
    if (hasRealId) {
      try {
        await prisma.as2InboundReceipt.create({ data: { tenantId, messageId: messageId! } });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          return mdn(
            { processed: true, warning: `duplicate-document: Message-ID ${messageId} bereits empfangen` },
            null,
          );
        }
        throw e;
      }
    }

    // 1) decrypt (if enveloped), 2) verify signature against the pinned cert.
    let signedBody = args.rawBody;
    let signedCt = contentType ?? "";
    try {
      if (/pkcs7-mime/i.test(signedCt) && /enveloped-data/i.test(signedCt)) {
        const dec = decryptMime(args.rawBody, identity);
        signedBody = dec.body;
        signedCt = dec.contentType;
      }
      if (!/multipart\/signed/i.test(signedCt)) {
        throw new Error("Nachricht ist nicht signiert (multipart/signed erwartet)");
      }
      const verified = verifySignedMime(signedBody, signedCt, mailbox.as2CertificatePem);

      const result = await ediService.processInbound({
        tenantId,
        raw: verified.payload,
        transport: "as2",
        createdBy: `as2:${mailbox.name}`,
        mailbox: {
          id: mailbox.id,
          name: mailbox.name,
          partnerGln: mailbox.partnerGln,
          supplierId: mailbox.supplierId,
        },
      });
      prisma.ediPartnerMailbox
        .update({ where: { id: mailbox.id }, data: { lastUsedAt: new Date() } })
        .catch(() => {});

      // MDN confirms secure receipt; application-level results live in the monitor.
      void result;
      return mdn({ processed: true }, verified.micBase64);
    } catch (e) {
      // Processing failed → release the replay lock so a corrected resend
      // with the same Message-ID isn't wrongly rejected as a duplicate.
      if (hasRealId) {
        await prisma.as2InboundReceipt
          .deleteMany({ where: { tenantId, messageId: messageId! } })
          .catch(() => {});
      }
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[as2-inbound-fail] from=${as2From} to=${as2To} error=${msg}`);
      // Make the crypto failure visible in the EDI monitor (was invisible before).
      await prisma.ediMessage
        .create({
          data: {
            tenantId, direction: "IN", type: "AS2", status: "FAILED", transport: "as2",
            supplierId: mailbox.supplierId, payload: args.rawBody,
            createdBy: `as2:${mailbox.name}`, error: msg,
          },
        })
        .catch(() => {});
      return mdn({ processed: false, error: msg }, null);
    }
  },
};
