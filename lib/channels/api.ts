import type { DispatchInput, DispatchResult } from "./types";

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

export async function dispatchApi(input: DispatchInput): Promise<DispatchResult> {
  const cfg = (input.order.supplier.channelConfig ?? {}) as ApiSupplierCfg;
  if (!cfg.url) return { channel: "API", ok: false, message: "Empfänger-URL fehlt (Supplier.channelConfig.url)." };

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

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.auth?.type === "bearer") headers["Authorization"] = `Bearer ${cfg.auth.token}`;
  else if (cfg.auth?.type === "apiKey") headers[cfg.auth.header ?? "X-API-Key"] = cfg.auth.token;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(cfg.url, { method: "POST", headers, body: JSON.stringify(payload), signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { channel: "API", ok: false, message: `Lieferanten-API antwortete ${res.status}`, details: { status: res.status, body: body.slice(0, 200) } };
    }
    return { channel: "API", ok: true, message: `API-Versand an ${cfg.url} (${res.status}).`, details: { status: res.status, url: cfg.url } };
  } catch (e) {
    clearTimeout(timeout);
    return { channel: "API", ok: false, message: `API-Versand fehlgeschlagen: ${(e as Error).message}` };
  }
}
