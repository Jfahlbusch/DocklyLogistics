import { describe, it, expect, vi, afterEach } from "vitest";
import { sendTestApi, dispatchApi } from "./api";
import type { DispatchInput } from "./types";

const NOW = "2026-06-23T00:00:00.000Z";

function makeDispatchInput(url: string | undefined, orderId = "order-123"): DispatchInput {
  return {
    order: {
      id: orderId,
      orderNo: "BST-1",
      createdAt: new Date("2026-06-23T00:00:00Z"),
      currency: "EUR",
      total: 100,
      notes: null,
      supplier: { channel: "API", channelConfig: url ? { url } : {} },
      items: [
        { qtyOrderUnit: 2, unitPrice: 10, lineTotal: 20, article: { sku: "A", name: "Art", orderUnit: "BOX", baseUnit: "PIECE" } },
      ],
    },
    tenantCfg: null,
    pdfBuffer: Buffer.from(""),
  } as unknown as DispatchInput;
}

const hdr = (call: unknown, name: string) =>
  ((call as [string, RequestInit])[1].headers as Record<string, string>)[name];

afterEach(() => vi.restoreAllMocks());

describe("sendTestApi", () => {
  it("returns ok=false when no callbackUrl is configured", async () => {
    const r = await sendTestApi({}, NOW);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/callbackUrl/i);
  });

  it("POSTs a ping and reports a 2xx as reachable", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));
    const r = await sendTestApi(
      { callbackUrl: "https://x.test/hook", defaultHeaders: { "X-Tok": "abc" } },
      NOW,
    );
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/erreichbar/);
    expect(r.details?.status).toBe(200);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://x.test/hook");
    expect((init?.headers as Record<string, string>)["X-Tok"]).toBe("abc");
    const body = JSON.parse(init?.body as string);
    expect(body.test).toBe(true);
    expect(body.sentAt).toBe(NOW);
  });

  it("reports a non-2xx as not reachable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 503 }));
    const r = await sendTestApi({ callbackUrl: "https://x.test/hook" }, NOW);
    expect(r.ok).toBe(false);
    expect(r.details?.status).toBe(503);
  });

  it("handles network errors gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const r = await sendTestApi({ callbackUrl: "https://x.test/hook" }, NOW);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/ECONNREFUSED/);
  });
});

describe("dispatchApi (retry + idempotency)", () => {
  it("sends Idempotency-Key = order.id and succeeds on 2xx", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 200 }));
    const r = await dispatchApi(makeDispatchInput("https://supp.test/orders", "ord-42"));
    expect(r.ok).toBe(true);
    expect(r.details?.idempotencyKey).toBe("ord-42");
    expect(hdr(fetchMock.mock.calls[0], "Idempotency-Key")).toBe("ord-42");
  });

  it("retries on 5xx then succeeds, reusing the same idempotency key", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("boom", { status: 503 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));
    const r = await dispatchApi(makeDispatchInput("https://supp.test/orders", "ord-7"));
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(hdr(fetchMock.mock.calls[0], "Idempotency-Key")).toBe("ord-7");
    expect(hdr(fetchMock.mock.calls[1], "Idempotency-Key")).toBe("ord-7"); // stable across retries
  });

  it("does NOT retry on a 4xx client error", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad", { status: 400 }));
    const r = await dispatchApi(makeDispatchInput("https://supp.test/orders"));
    expect(r.ok).toBe(false);
    expect(r.details?.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on a network error then succeeds", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(new Response("", { status: 200 }));
    const r = await dispatchApi(makeDispatchInput("https://supp.test/orders"));
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns a clear error when the recipient URL is missing", async () => {
    const r = await dispatchApi(makeDispatchInput(undefined));
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/URL fehlt/);
  });
});
