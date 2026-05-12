import { describe, it, expect } from "vitest";
import { signWebhook, verifyWebhookSignature } from "./webhook-sign";

describe("signWebhook / verify", () => {
  it("signs and verifies a body", () => {
    const body = JSON.stringify({ event: "order.sent", id: "abc" });
    const signed = signWebhook(body, "topsecret", new Date());
    const r = verifyWebhookSignature(body, "topsecret", signed.timestamp, signed.signature);
    expect(r.ok).toBe(true);
  });

  it("rejects wrong secret", () => {
    const body = "x";
    const signed = signWebhook(body, "topsecret");
    const r = verifyWebhookSignature(body, "wrong", signed.timestamp, signed.signature);
    expect(r.ok).toBe(false);
  });

  it("rejects stale timestamp (>5min)", () => {
    const body = "x";
    const past = new Date(Date.now() - 1000 * 60 * 10);
    const signed = signWebhook(body, "s", past);
    const r = verifyWebhookSignature(body, "s", signed.timestamp, signed.signature);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("stale timestamp");
  });

  it("rejects tampered body", () => {
    const signed = signWebhook("original", "s");
    const r = verifyWebhookSignature("tampered", "s", signed.timestamp, signed.signature);
    expect(r.ok).toBe(false);
  });
});
