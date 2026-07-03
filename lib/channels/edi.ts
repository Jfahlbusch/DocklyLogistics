import fs from "node:fs/promises";
import path from "node:path";
import type { DispatchInput, DispatchResult } from "./types";
import { withRetry } from "./retry";
import { isBlockedUrl } from "@/lib/net/ssrf-guard";
import { generateOrdersEdifact } from "@/lib/edi/generate-orders";
import { ediMessageRepo } from "@/lib/db/repos/edi-message";
import { tenantEdiSettingsRepo } from "@/lib/db/repos/tenant-edi-settings";
import { ediPartnerMailboxRepo } from "@/lib/db/repos/edi-partner-mailbox";
import { ediService } from "@/lib/services/edi-service";
import { as2Service } from "@/lib/services/as2-service";
import { sendAs2Raw, newAs2MessageId } from "./as2-transport";

/**
 * EDI channel: emit a real EDIFACT ORDERS D.96A, archive it as EdiMessage(OUT)
 * and deliver it. Transport per supplier (Supplier.channelConfig):
 *   - `url` set   → HTTPS POST of the raw payload (classic EDI-over-HTTP mailbox)
 *   - no `url`    → file drop (pickup directory), like the previous mock
 * The tenant's own identity (GLN/qualifier) comes from the EDI Versandprofil
 * (TenantChannelConfig, channel=EDI).
 */

const PICKUP_DIR = "/tmp/docklylogistics-edi";
const EDI_TIMEOUT_MS = 10_000;

type EdiTenantCfg = { senderId: string; senderQualifier: string; edifactVersion: string };
type EdiSupplierCfg = {
  partnerId?: string;
  partnerQualifier?: string;
  url?: string;
  headers?: Record<string, string>;
};

export type EdiTestResult = { ok: boolean; message: string; details?: Record<string, unknown> };

/**
 * Profile test (Einstellungen → Versand → Test): generate a self-addressed
 * ORDERS from the profile's identity and run it through the REAL inbound
 * pipeline — the same code path partners hit. Proves generator + parsing and
 * leaves a visible PROCESSED entry in the EDI monitor. No partner is
 * contacted (the transport target lives per supplier, not on the profile).
 */
export async function sendTestEdi(
  tenantId: string,
  rawCfg: Record<string, unknown>,
): Promise<EdiTestResult> {
  const cfg = rawCfg as Partial<EdiTenantCfg>;
  if (!cfg.senderId || !cfg.senderQualifier || !cfg.edifactVersion) {
    return {
      ok: false,
      message: "Profil unvollständig — senderId, senderQualifier und edifactVersion werden benötigt.",
    };
  }

  const docNo = `TEST-${Date.now().toString(36).toUpperCase()}`;
  const generated = generateOrdersEdifact({
    orderNo: docNo,
    currency: "EUR",
    orderDate: new Date(),
    sender: { id: cfg.senderId, qualifier: cfg.senderQualifier },
    recipient: { id: cfg.senderId, qualifier: cfg.senderQualifier }, // Loopback an sich selbst
    items: [
      { sku: "EDI-TEST", name: "Testposition (Profil-Test)", ean: null, qtyOrderUnit: 1, orderUnit: "PIECE", unitPrice: 0 },
    ],
  });

  const settings = await tenantEdiSettingsRepo.ensure(tenantId);
  if (!settings.inboundActive) {
    return {
      ok: true,
      message: "EDIFACT erfolgreich generiert (Profil gültig). Hinweis: Das EDI-Postfach ist deaktiviert, daher keine Loopback-Zustellung.",
      details: { interchangeRef: generated.interchangeRef, bytes: generated.payload.length },
    };
  }

  const result = await ediService.processInbound({
    tenantId,
    raw: generated.payload,
    transport: "test-loopback",
    createdBy: "channel-test",
  });
  if (result.status === "PROCESSED") {
    return {
      ok: true,
      message: `Test erfolgreich: ORDERS ${docNo} generiert, über das Postfach empfangen und verarbeitet — im Bereich EDI einsehbar.`,
      details: { messageId: result.messageId, interchangeRef: generated.interchangeRef },
    };
  }
  return {
    ok: false,
    message: `Test-Nachricht wurde empfangen, aber nicht verarbeitet: ${result.error ?? "unbekannter Fehler"}`,
    details: { messageId: result.messageId },
  };
}

class EdiDispatchError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "EdiDispatchError";
  }
}

async function postEdifact(
  url: string,
  payload: string,
  orderId: string,
  extraHeaders: Record<string, string>,
): Promise<number> {
  return withRetry(
    async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), EDI_TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            // Stable across retries so the partner can dedupe re-sent interchanges.
            "Idempotency-Key": orderId,
            ...extraHeaders,
          },
          body: payload,
          signal: controller.signal,
        });
        if (!res.ok) {
          const retryable = res.status >= 500 || res.status === 429;
          throw new EdiDispatchError(`Partner antwortete HTTP ${res.status}`, retryable, res.status);
        }
        return res.status;
      } catch (e) {
        if (e instanceof EdiDispatchError) throw e;
        // network error / timeout → transient
        throw new EdiDispatchError(`Übertragung fehlgeschlagen: ${(e as Error).message}`, true);
      } finally {
        clearTimeout(timeout);
      }
    },
    { attempts: 3, baseMs: 500, isRetryable: (e) => e instanceof EdiDispatchError && e.retryable },
  );
}

export async function dispatchEdi(input: DispatchInput): Promise<DispatchResult> {
  const tenant = (input.tenantCfg?.config ?? {}) as EdiTenantCfg;
  if (!tenant.senderId || !tenant.senderQualifier || !tenant.edifactVersion) {
    return {
      channel: "EDI", ok: false,
      message: "EDI-Versandprofil unvollständig (senderId/senderQualifier/edifactVersion fehlen).",
    };
  }
  const supplier = (input.order.supplier.channelConfig ?? {}) as EdiSupplierCfg;
  if (!supplier.partnerId) {
    return {
      channel: "EDI", ok: false,
      message: "Partner-Kennung fehlt (Supplier.channelConfig.partnerId — GLN des Lieferanten).",
    };
  }

  const o = input.order;
  const generated = generateOrdersEdifact({
    orderNo: o.orderNo,
    currency: o.currency,
    orderDate: o.createdAt,
    sender: { id: tenant.senderId, qualifier: tenant.senderQualifier },
    recipient: { id: supplier.partnerId, qualifier: supplier.partnerQualifier ?? "14" },
    items: o.items.map((it) => ({
      sku: it.article.sku,
      name: it.article.name,
      ean: it.article.eanGtin,
      qtyOrderUnit: it.qtyOrderUnit,
      orderUnit: it.article.orderUnit,
      unitPrice: Number(it.unitPrice),
    })),
  });

  // AS2 wins when the supplier has an AS2-capable partner mailbox AND we have
  // an identity — certificate-based, signed+encrypted, MDN-confirmed.
  const as2Mailbox = await ediPartnerMailboxRepo.findAs2ForSupplier(o.tenantId, o.supplierId);
  const as2Identity = as2Mailbox ? await as2Service.getSigningIdentity(o.tenantId) : null;

  if (as2Mailbox && as2Identity) {
    const record = await ediMessageRepo.create({
      tenantId: o.tenantId,
      direction: "OUT",
      type: "ORDERS",
      status: "PENDING",
      transport: "as2",
      supplierId: o.supplierId,
      orderId: o.id,
      interchangeRef: generated.interchangeRef,
      documentNo: o.orderNo,
      payload: generated.payload,
      createdBy: o.createdBy,
    });
    const result = await sendAs2Raw(
      as2Identity,
      { as2Id: as2Mailbox.as2Id!, as2Url: as2Mailbox.as2Url!, as2CertificatePem: as2Mailbox.as2CertificatePem! },
      generated.payload,
      { messageId: newAs2MessageId(o.id), idempotencyKey: o.id },
    );
    if (result.ok) {
      await ediMessageRepo.update(record.id, { status: "SENT" });
      return {
        channel: "EDI", ok: true,
        message: "EDIFACT ORDERS per AS2 übertragen — signierte Empfangsquittung (MDN) validiert.",
        details: {
          ediMessageId: record.id,
          interchangeRef: generated.interchangeRef,
          mdnDisposition: result.mdnDisposition,
          micVerified: result.micVerified,
        },
      };
    }
    await ediMessageRepo.update(record.id, { status: "SEND_FAILED", error: result.error });
    return {
      channel: "EDI", ok: false,
      message: `AS2-Versand fehlgeschlagen: ${result.error}`,
      details: { ediMessageId: record.id, interchangeRef: generated.interchangeRef },
    };
  }

  const transport = supplier.url ? "http" : "file";
  const record = await ediMessageRepo.create({
    tenantId: o.tenantId,
    direction: "OUT",
    type: "ORDERS",
    status: "PENDING",
    transport,
    supplierId: o.supplierId,
    orderId: o.id,
    interchangeRef: generated.interchangeRef,
    documentNo: o.orderNo,
    payload: generated.payload,
    createdBy: o.createdBy,
  });

  if (transport === "http") {
    const url = supplier.url!;
    if (isBlockedUrl(url)) {
      await ediMessageRepo.update(record.id, {
        status: "SEND_FAILED",
        error: "Partner-URL zeigt auf ein internes/ungültiges Ziel (SSRF-Schutz).",
      });
      return {
        channel: "EDI", ok: false,
        message: "Partner-URL zeigt auf ein internes/ungültiges Ziel (SSRF-Schutz).",
        details: { ediMessageId: record.id },
      };
    }
    try {
      const status = await postEdifact(url, generated.payload, o.id, supplier.headers ?? {});
      await ediMessageRepo.update(record.id, { status: "SENT" });
      return {
        channel: "EDI", ok: true,
        message: `EDIFACT ORDERS an Partner übertragen (HTTP ${status}).`,
        details: { ediMessageId: record.id, interchangeRef: generated.interchangeRef, status },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await ediMessageRepo.update(record.id, { status: "SEND_FAILED", error: msg });
      return {
        channel: "EDI", ok: false,
        message: `EDI-Übertragung fehlgeschlagen: ${msg}`,
        details: { ediMessageId: record.id, interchangeRef: generated.interchangeRef },
      };
    }
  }

  // File transport — pickup directory (no partner URL configured).
  try {
    await fs.mkdir(PICKUP_DIR, { recursive: true });
    const filePath = path.join(PICKUP_DIR, `${o.orderNo}.edi`);
    await fs.writeFile(filePath, generated.payload);
    await ediMessageRepo.update(record.id, { status: "SENT" });
    return {
      channel: "EDI", ok: true,
      message: "EDIFACT ORDERS bereitgestellt (Datei-Transport, keine Partner-URL konfiguriert).",
      details: { ediMessageId: record.id, interchangeRef: generated.interchangeRef, filePath },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await ediMessageRepo.update(record.id, { status: "SEND_FAILED", error: msg });
    return { channel: "EDI", ok: false, message: `EDI-Bereitstellung fehlgeschlagen: ${msg}`, details: { ediMessageId: record.id } };
  }
}
