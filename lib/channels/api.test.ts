import { describe, it, expect, vi, afterEach } from "vitest";
import { sendTestApi } from "./api";

const NOW = "2026-06-23T00:00:00.000Z";

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
