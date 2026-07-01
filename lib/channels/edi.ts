import fs from "node:fs/promises";
import path from "node:path";
import type { DispatchInput, DispatchResult } from "./types";
import { withRetry } from "./retry";
import { isBlockedUrl } from "@/lib/net/ssrf-guard";
import { generateOrdersEdifact } from "@/lib/edi/generate-orders";
import { ediMessageRepo } from "@/lib/db/repos/edi-message";

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
