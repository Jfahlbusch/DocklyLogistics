import { describe, it, expect } from "vitest";
import { generateApiKey, parseApiKey, hashSecret, timingSafeEqualHex } from "./api-key";

describe("generateApiKey", () => {
  it("returns prefix starting with dlg_live_", () => {
    const k = generateApiKey();
    expect(k.prefix.startsWith("dlg_live_")).toBe(true);
    expect(k.prefix.length).toBe("dlg_live_".length + 24);
  });
  it("fullKey embeds prefix and 32-char secret separated by .", () => {
    const k = generateApiKey();
    expect(k.fullKey.startsWith(k.prefix + ".")).toBe(true);
    const secret = k.fullKey.slice(k.prefix.length + 1);
    expect(secret.length).toBe(32);
  });
  it("hash matches sha256 of the secret part", () => {
    const k = generateApiKey();
    const secret = k.fullKey.slice(k.prefix.length + 1);
    expect(hashSecret(secret)).toBe(k.hash);
  });
});

describe("parseApiKey", () => {
  it("parses a valid key", () => {
    const k = generateApiKey();
    const parsed = parseApiKey(k.fullKey);
    expect(parsed?.prefix).toBe(k.prefix);
    expect(parsed?.secret.length).toBe(32);
  });
  it("rejects null / empty", () => {
    expect(parseApiKey(null)).toBeNull();
    expect(parseApiKey("")).toBeNull();
  });
  it("rejects key without dot separator", () => {
    expect(parseApiKey("dlg_live_xyznoSecret")).toBeNull();
  });
  it("rejects key without dlg_live_ prefix", () => {
    expect(parseApiKey("foo_bar_abc.secret")).toBeNull();
  });
});

describe("timingSafeEqualHex", () => {
  it("compares equal hex strings", () => {
    expect(timingSafeEqualHex("deadbeef", "deadbeef")).toBe(true);
  });
  it("rejects different lengths", () => {
    expect(timingSafeEqualHex("deadbeef", "deadbeef00")).toBe(false);
  });
  it("rejects different content", () => {
    expect(timingSafeEqualHex("deadbeef", "feedbeef")).toBe(false);
  });
});
