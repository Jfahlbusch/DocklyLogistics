import { describe, it, expect } from "vitest";
import { isBlockedUrl } from "./ssrf-guard";

describe("isBlockedUrl", () => {
  it("blocks loopback / link-local / metadata / RFC-1918", () => {
    for (const u of [
      "http://127.0.0.1/x",
      "http://localhost/x",
      "http://169.254.169.254/latest/meta-data/",
      "http://10.0.0.5/",
      "http://192.168.1.1/",
      "http://172.16.0.1/",
      "http://172.31.255.1/",
      "http://[::1]/",
      "https://0.0.0.0/",
    ]) {
      expect(isBlockedUrl(u), u).toBe(true);
    }
  });

  it("blocks non-http(s), unparseable and empty", () => {
    expect(isBlockedUrl("ftp://example.com")).toBe(true);
    expect(isBlockedUrl("file:///etc/passwd")).toBe(true);
    expect(isBlockedUrl("kein-url")).toBe(true);
    expect(isBlockedUrl("")).toBe(true);
    expect(isBlockedUrl(null)).toBe(true);
  });

  it("allows public destinations", () => {
    for (const u of [
      "https://example.test/hook",
      "https://api.supplier.com/orders",
      "http://203.0.113.5/",
      "https://172.32.0.1/", // outside RFC-1918
    ]) {
      expect(isBlockedUrl(u), u).toBe(false);
    }
  });
});
