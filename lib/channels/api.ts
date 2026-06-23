import type { DispatchInput, DispatchResult } from "./types";
import { withRetry } from "./retry";

type ApiSupplierCfg = {
  url?: string;
  auth?: { type: "bearer" | "apiKey"; token: string; header?: string };
};

/** Tenant-level API channel config (TenantChannelConfig.config for channel API). */
type ApiChannelTestCfg = {
  callbackUrl?: string;
  defaultHeaders?: Record<string, string>;
  defaultClientId?: string;
};

export type ApiTestResult = { ok: boolean; message: string; details?: Record<string, unknown> };

/**
 * Connectivity test for an API channel profile: POST a ping payload to the
 * configured `callbackUrl` and report the HTTP status. Single attempt (no
 * retry) — a test should surface the immediate result, not paper over it.
 */
export async function sendTestApi(rawCfg: Record<string, unknown>, nowIso: string): Promise<ApiTestResult> {
  const cfg = rawCfg as ApiChannelTestCfg;
  if (!cfg.callbackUrl) {
    return { ok: false, message: "Keine callbackUrl im API-Profil hinterlegt — nichts zu testen." };
  }
  const payload = {
    test: true,
    event: "channel.test",
    message: "DocklyLogistics API-Kanal Test-Ping",
    clientId: cfg.defaultClientId,
    sentAt: nowIso,
  };
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(cfg.defaultHeaders ?? {}) };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(cfg.callbackUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const body = await res.text().catch(() => "");
    return {
      ok: res.ok,
      message: res.ok ? `API-Endpunkt erreichbar (${res.status}).` : `API-Endpunkt antwortete ${res.status}.`,
      details: { status: res.status, url: cfg.callbackUrl, body: body.slice(0, 200) },
    };
  } catch (e) {
    clearTimeout(timeout);
    return { ok: false, message: `API-Test fehlgeschlagen: ${(e as Error).message}`, details: { url: cfg.callbackUrl } };
  }
}

/** A failed HTTP attempt, tagged with whether retrying could plausibly help. */
class ApiDispatchError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean,
    readonly body?: string,
  ) {
    super(message);
    this.name = "ApiDispatchError";
  }
}

const API_TIMEOUT_MS = 10_000;

export async function dispatchApi(input: DispatchInput): Promise<DispatchResult> {
  const cfg = (input.order.supplier.channelConfig ?? {}) as ApiSupplierCfg;
  if (!cfg.url) return { channel: "API", ok: false, message: "Empfänger-URL fehlt (Supplier.channelConfig.url)." };
  const url = cfg.url;

  const payload = {
    orderNo: input.order.orderNo,
    createdAt: input.order.createdAt.toISOString(),
    currency: input.order.currency,
    total: Number(input.order.total),
    notes: input.order.notes,
    items: input.order.items.map((it) => ({
      sku: it.article.sku,
      name: it.article.name,
      qtyOrderUnit: it.qtyOrderUnit,
      orderUnit: it.article.orderUnit,
      unitPrice: Number(it.unitPrice),
      lineTotal: Number(it.lineTotal),
    })),
  };
  const body = JSON.stringify(payload);

  // Stable idempotency key for the whole dispatch — identical across retries so the
  // receiver can dedupe a delivery that a transient timeout forced us to re-send.
  const idempotencyKey = input.order.id;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey,
  };
  if (cfg.auth?.type === "bearer") headers["Authorization"] = `Bearer ${cfg.auth.token}`;
  else if (cfg.auth?.type === "apiKey") headers[cfg.auth.header ?? "X-API-Key"] = cfg.auth.token;

  try {
    const status = await withRetry(
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
        try {
          const res = await fetch(url, { method: "POST", headers, body, signal: controller.signal });
          if (!res.ok) {
            const respBody = await res.text().catch(() => "");
            // 5xx/429 are transient → retry; 4xx is a client error → give up immediately.
            const retryable = res.status >= 500 || res.status === 429;
            throw new ApiDispatchError(`Lieferanten-API antwortete ${res.status}`, res.status, retryable, respBody.slice(0, 200));
          }
          return res.status;
        } finally {
          clearTimeout(timeout);
        }
      },
      {
        attempts: 3,
        baseMs: 500,
        // Network/abort errors aren't ApiDispatchError → treat as transient → retry.
        isRetryable: (e) => (e instanceof ApiDispatchError ? e.retryable : true),
      },
    );
    return {
      channel: "API",
      ok: true,
      message: `API-Versand an ${url} (${status}).`,
      details: { status, url, idempotencyKey },
    };
  } catch (e) {
    if (e instanceof ApiDispatchError) {
      return { channel: "API", ok: false, message: e.message, details: { status: e.status, body: e.body, idempotencyKey } };
    }
    return { channel: "API", ok: false, message: `API-Versand fehlgeschlagen: ${(e as Error).message}`, details: { idempotencyKey } };
  }
}
