import { prisma } from "@/lib/db/client";
import { sftp, type SftpConfig, type RemoteFile } from "@/lib/edi/sftp";
import { tenantSftpSettingsRepo } from "@/lib/db/repos/tenant-sftp-settings";
import { ediMessageRepo } from "@/lib/db/repos/edi-message";
import { as2Service } from "@/lib/services/as2-service";
import { sendAs2Raw, newAs2MessageId } from "@/lib/channels/as2-transport";
import { withRetry } from "@/lib/channels/retry";
import { isBlockedUrl } from "@/lib/net/ssrf-guard";
import { renderOrderXml, type OrderXmlInput } from "@/lib/edi/order-xml";
import { parseInterchange, findSeg } from "@/lib/edi/edifact";
import type { TenantSftpSettings } from "@prisma/client";

/**
 * SFTP bridge to the Warenwirtschaft. DocklyLogistics is the client:
 *  - Outbox: the WaWi drops ready EDIFACT; we route by recipient and relay it
 *    to the trading partner (AS2 preferred, else HTTPS), then move the file to
 *    sent/ or error/.
 *  - Inbox: documents we received/generated are written here for the WaWi.
 */

function toConfig(s: TenantSftpSettings): SftpConfig {
  return {
    host: s.host,
    port: s.port,
    username: s.username,
    authType: s.authType,
    privateKeyEncrypted: s.privateKeyEncrypted,
    passwordEncrypted: s.passwordEncrypted,
    hostKeyFingerprint: s.hostKeyFingerprint,
  };
}

/** Recipient GLN from an EDIFACT interchange (UNB recipient) — null if absent. */
export function resolveRecipientFromEdifact(text: string): string | null {
  try {
    return parseInterchange(text).envelope?.recipientId ?? null;
  } catch {
    return null;
  }
}

/** Doc type + number for the monitor (best effort). */
function describe(text: string): { type: string; documentNo: string | null } {
  try {
    const p = parseInterchange(text);
    const first = p.messages[0];
    const bgm = first ? findSeg(first.segments, "BGM") : undefined;
    return { type: first?.type ?? "EDIFACT", documentNo: bgm?.elements[1]?.[0] ?? null };
  } catch {
    return { type: "EDIFACT", documentNo: null };
  }
}

type RelayTarget =
  | { kind: "as2"; supplierId: string | null; as2: { as2Id: string; as2Url: string; as2CertificatePem: string } }
  | { kind: "http"; supplierId: string; url: string };

/** Resolve which partner + channel a recipient GLN maps to (AS2 preferred). */
export async function findRelayTarget(tenantId: string, recipientGln: string): Promise<RelayTarget | null> {
  const mailbox = await prisma.ediPartnerMailbox.findFirst({
    where: {
      tenantId, active: true, partnerGln: recipientGln,
      as2Url: { not: null }, as2CertificatePem: { not: null }, as2Id: { not: null },
    },
  });
  if (mailbox) {
    return {
      kind: "as2",
      supplierId: mailbox.supplierId,
      as2: { as2Id: mailbox.as2Id!, as2Url: mailbox.as2Url!, as2CertificatePem: mailbox.as2CertificatePem! },
    };
  }
  const supplier = await prisma.supplier.findFirst({
    where: { tenantId, channel: "EDI", channelConfig: { path: ["partnerId"], equals: recipientGln } },
  });
  const cfg = (supplier?.channelConfig ?? {}) as { url?: string };
  if (supplier && cfg.url) return { kind: "http", supplierId: supplier.id, url: cfg.url };
  return null;
}

export type RelayResult = { ok: boolean; messageId: string; error?: string };

export const sftpService = {
  /** Relay one outbound file (EDIFACT bytes) to its trading partner. */
  async relayOne(
    tenantId: string,
    recipientGln: string | null,
    bytes: Buffer,
    sourceName: string,
  ): Promise<RelayResult> {
    const text = bytes.toString("utf8");
    const { type, documentNo } = describe(text);

    const fail = async (transport: string, supplierId: string | null, error: string): Promise<RelayResult> => {
      const m = await ediMessageRepo.create({
        tenantId, direction: "OUT", type, status: "SEND_FAILED", transport,
        supplierId, documentNo, payload: text, createdBy: "sftp-relay", error,
      });
      return { ok: false, messageId: m.id, error };
    };

    if (!recipientGln) return fail("sftp", null, "Kein Empfänger aus der Datei ermittelbar (EDIFACT-UNB fehlt).");

    const target = await findRelayTarget(tenantId, recipientGln);
    if (!target) return fail("sftp", null, `Kein Partner für Empfänger-GLN ${recipientGln} hinterlegt.`);

    const record = await ediMessageRepo.create({
      tenantId, direction: "OUT", type, status: "PENDING",
      transport: target.kind === "as2" ? "as2" : "http",
      supplierId: target.supplierId, documentNo, payload: text, createdBy: "sftp-relay",
    });

    if (target.kind === "as2") {
      const identity = await as2Service.getSigningIdentity(tenantId);
      if (!identity) {
        await ediMessageRepo.update(record.id, { status: "SEND_FAILED", error: "Keine AS2-Identität erzeugt." });
        return { ok: false, messageId: record.id, error: "Keine AS2-Identität erzeugt." };
      }
      const r = await sendAs2Raw(identity, target.as2, text, {
        messageId: newAs2MessageId(sourceName),
        idempotencyKey: sourceName,
      });
      await ediMessageRepo.update(record.id, r.ok ? { status: "SENT" } : { status: "SEND_FAILED", error: r.error });
      return { ok: r.ok, messageId: record.id, error: r.ok ? undefined : r.error };
    }

    // HTTP relay
    if (isBlockedUrl(target.url)) {
      const e = "Empfänger-URL zeigt auf ein internes/ungültiges Ziel (SSRF-Schutz).";
      await ediMessageRepo.update(record.id, { status: "SEND_FAILED", error: e });
      return { ok: false, messageId: record.id, error: e };
    }
    try {
      await withRetry(
        async () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);
          try {
            const res = await fetch(target.url, {
              method: "POST",
              headers: { "Content-Type": "text/plain; charset=utf-8", "Idempotency-Key": sourceName },
              body: text,
              signal: controller.signal,
            });
            if (!res.ok) {
              const err = new Error(`HTTP ${res.status}`);
              (err as Error & { retryable?: boolean }).retryable = res.status >= 500 || res.status === 429;
              throw err;
            }
          } finally {
            clearTimeout(timeout);
          }
        },
        { attempts: 3, baseMs: 500, isRetryable: (e) => !!(e as { retryable?: boolean })?.retryable },
      );
      await ediMessageRepo.update(record.id, { status: "SENT" });
      return { ok: true, messageId: record.id };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await ediMessageRepo.update(record.id, { status: "SEND_FAILED", error });
      return { ok: false, messageId: record.id, error };
    }
  },

  /** Poll a tenant's outbox and dispatch every new file. */
  async pollOutbox(tenantId: string): Promise<{ processed: number; sent: number; failed: number }> {
    const s = await tenantSftpSettingsRepo.get(tenantId);
    if (!s || !s.active) return { processed: 0, sent: 0, failed: 0 };
    const cfg = toConfig(s);
    let processed = 0, sent = 0, failed = 0;
    try {
      const jobs: Array<{ gln: string | null; file: RemoteFile }> = [];
      if (s.routing === "SUBFOLDER") {
        for (const dir of await sftp.listDirs(cfg, s.outboxDir)) {
          if (dir === "sent" || dir === "error") continue;
          for (const f of await sftp.listFiles(cfg, `${s.outboxDir.replace(/\/$/, "")}/${dir}`)) {
            jobs.push({ gln: dir, file: f });
          }
        }
      } else {
        for (const f of await sftp.listFiles(cfg, s.outboxDir)) jobs.push({ gln: null, file: f });
      }

      for (const j of jobs) {
        processed++;
        try {
          const bytes = await sftp.readFile(cfg, j.file.path);
          const recipient = j.gln ?? resolveRecipientFromEdifact(bytes.toString("utf8"));
          const r = await this.relayOne(tenantId, recipient, bytes, j.file.name);
          await sftp.moveToSubfolder(cfg, j.file.path, r.ok ? "sent" : "error");
          if (r.ok) sent++; else failed++;
        } catch {
          failed++;
          await sftp.moveToSubfolder(cfg, j.file.path, "error").catch(() => {});
        }
      }
      await tenantSftpSettingsRepo.setPollResult(tenantId, failed > 0 ? `${failed} Datei(en) fehlgeschlagen` : null);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await tenantSftpSettingsRepo.setPollResult(tenantId, error);
      throw e;
    }
    return { processed, sent, failed };
  },

  /** Poll every tenant with active auto-send (called by the cron). */
  async pollAll(): Promise<{ tenants: number; results: unknown[] }> {
    const tenants = await tenantSftpSettingsRepo.listActiveAutoSend();
    const results: unknown[] = [];
    for (const t of tenants) {
      try {
        results.push({ tenantId: t.tenantId, ...(await this.pollOutbox(t.tenantId)) });
      } catch (e) {
        results.push({ tenantId: t.tenantId, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return { tenants: tenants.length, results };
  },

  /** Write a received/generated order into the tenant's inbox for the WaWi. */
  async deliverOrderToInbox(tenantId: string, order: OrderXmlInput, rawEdifact?: string): Promise<boolean> {
    const s = await tenantSftpSettingsRepo.get(tenantId);
    if (!s || !s.active) return false;
    const cfg = toConfig(s);
    const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
    const safeDoc = (order.documentNo || "order").replace(/[^A-Za-z0-9_-]/g, "");
    const isXml = s.inboxFormat !== "EDIFACT";
    const content = isXml ? renderOrderXml(order) : (rawEdifact ?? renderOrderXml(order));
    const ext = isXml ? "xml" : "edi";
    await sftp.writeFile(cfg, `${s.inboxDir.replace(/\/$/, "")}/${safeDoc}_${stamp}.${ext}`, content);
    return true;
  },

  /** Connection test for the settings UI. */
  async testConnection(tenantId: string) {
    const s = await tenantSftpSettingsRepo.get(tenantId);
    if (!s) return { ok: false, message: "Keine SFTP-Einstellungen hinterlegt." };
    try {
      const r = await sftp.test(toConfig(s), s.outboxDir, s.inboxDir);
      return { ok: true, message: `Verbunden. Ausgang: ${r.outboxCount} Datei(en), Eingang: ${r.inboxCount}.` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  },
};
