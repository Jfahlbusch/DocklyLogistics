import { describe, it, expect, beforeAll } from "vitest";
import crypto from "node:crypto";
import { encryptSecret, decryptSecret, generateWebhookSecret } from "./aes";

beforeAll(() => {
  process.env.APP_KEY = crypto.randomBytes(32).toString("hex");
});

describe("aes encrypt/decrypt", () => {
  it("roundtrips a value", () => {
    const enc = encryptSecret("hello world");
    expect(enc).not.toBe("hello world");
    expect(decryptSecret(enc)).toBe("hello world");
  });
  it("produces different ciphertexts for same input (random IV)", () => {
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same");
    expect(decryptSecret(b)).toBe("same");
  });
  it("rejects tampered ciphertext", () => {
    const enc = encryptSecret("payload");
    const tampered = enc.slice(0, -1) + (enc.slice(-1) === "A" ? "B" : "A");
    expect(() => decryptSecret(tampered)).toThrow();
  });
});

describe("generateWebhookSecret", () => {
  it("returns base64url-encoded 32 random bytes", () => {
    const s = generateWebhookSecret();
    expect(s.length).toBeGreaterThan(30);
    expect(/^[A-Za-z0-9_-]+$/.test(s)).toBe(true);
  });
});
