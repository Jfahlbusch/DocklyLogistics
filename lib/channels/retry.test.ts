import { describe, it, expect } from "vitest";
import { withRetry } from "./retry";
import { ScalewayTemError, isRetryableTemError } from "./scaleway-mail";

const opts = { attempts: 3, baseMs: 1, isRetryable: isRetryableTemError };

describe("withRetry", () => {
  it("succeeds after transient failures", async () => {
    let calls = 0;
    const r = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new ScalewayTemError(503, "down");
      return "ok";
    }, opts);
    expect(r).toBe("ok");
    expect(calls).toBe(3);
  });

  it("does not retry a non-retryable error", async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw new ScalewayTemError(400, "bad request");
      }, opts),
    ).rejects.toThrow(/bad request/);
    expect(calls).toBe(1);
  });

  it("throws after exhausting attempts", async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw new ScalewayTemError(500, "down");
      }, { ...opts, attempts: 2 }),
    ).rejects.toThrow(/down/);
    expect(calls).toBe(2);
  });
});

describe("isRetryableTemError", () => {
  it("retries 5xx and 429, not 4xx", () => {
    expect(isRetryableTemError(new ScalewayTemError(500, ""))).toBe(true);
    expect(isRetryableTemError(new ScalewayTemError(429, ""))).toBe(true);
    expect(isRetryableTemError(new ScalewayTemError(403, ""))).toBe(false);
  });

  it("retries network/timeout, not generic errors", () => {
    expect(isRetryableTemError(new TypeError("fetch failed"))).toBe(true);
    expect(isRetryableTemError(new Error("Anhang über 2 MB"))).toBe(false);
  });
});
