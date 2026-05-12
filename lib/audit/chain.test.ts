import { describe, it, expect } from "vitest";
import { auditLogHash, orderEventHash, GENESIS_PREV_HASH, canonicalJson } from "./chain";

describe("canonicalJson", () => {
  it("sorts keys deterministically", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });
  it("handles nested objects", () => {
    expect(canonicalJson({ a: { z: 1, y: 2 } })).toBe('{"a":{"y":2,"z":1}}');
  });
  it("preserves array order", () => {
    expect(canonicalJson([1, 2, 3])).toBe("[1,2,3]");
  });
  it("encodes null and primitives", () => {
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson("x")).toBe('"x"');
    expect(canonicalJson(42)).toBe("42");
  });
});

describe("auditLogHash", () => {
  const baseAt = new Date("2026-05-12T10:00:00Z");
  const base = {
    tenantId: "demo", entity: "Article", entityId: "a1",
    action: "CREATE", actorId: "u1", actorEmail: "u@x",
    before: null, after: { sku: "MEHL-1" }, createdAt: baseAt,
  };

  it("produces a 64-char hex hash", () => {
    const h = auditLogHash(base, GENESIS_PREV_HASH);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    expect(auditLogHash(base, GENESIS_PREV_HASH)).toBe(auditLogHash(base, GENESIS_PREV_HASH));
  });

  it("changes when prevHash changes", () => {
    const a = auditLogHash(base, GENESIS_PREV_HASH);
    const b = auditLogHash(base, "ff".repeat(32));
    expect(a).not.toBe(b);
  });

  it("changes when payload changes", () => {
    const a = auditLogHash(base, GENESIS_PREV_HASH);
    const b = auditLogHash({ ...base, action: "UPDATE" }, GENESIS_PREV_HASH);
    expect(a).not.toBe(b);
  });

  it("is insensitive to property order in 'after'", () => {
    const a = auditLogHash({ ...base, after: { a: 1, b: 2 } }, GENESIS_PREV_HASH);
    const b = auditLogHash({ ...base, after: { b: 2, a: 1 } }, GENESIS_PREV_HASH);
    expect(a).toBe(b);
  });
});

describe("orderEventHash", () => {
  const base = {
    orderId: "o1", type: "STATUS_CHANGED", fromStatus: "REVIEW", toStatus: "APPROVED",
    actorId: "u1", payload: { from: "REVIEW" }, createdAt: new Date("2026-05-12T11:00:00Z"),
  };

  it("produces a 64-char hex hash", () => {
    expect(orderEventHash(base, GENESIS_PREV_HASH)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes with prevHash chain", () => {
    const a = orderEventHash(base, GENESIS_PREV_HASH);
    const b = orderEventHash(base, a);
    expect(a).not.toBe(b);
  });
});
