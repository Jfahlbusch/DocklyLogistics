import crypto from "node:crypto";

export const GENESIS_PREV_HASH = "0".repeat(64);

/**
 * Canonical JSON serializer with deterministic key ordering — required so
 * hash computation is stable across machines / Node versions.
 */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const obj = value as Record<string, unknown>;
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k])).join(",") + "}";
}

export type AuditLogPayload = {
  tenantId: string;
  entity: string;
  entityId: string;
  action: string;
  actorId: string;
  actorEmail: string;
  before: unknown;
  after: unknown;
  createdAt: Date;
};

export function auditLogPayloadCanonical(p: AuditLogPayload): string {
  return canonicalJson({
    tenantId: p.tenantId,
    entity: p.entity,
    entityId: p.entityId,
    action: p.action,
    actorId: p.actorId,
    actorEmail: p.actorEmail,
    before: p.before ?? null,
    after: p.after ?? null,
    createdAt: p.createdAt.toISOString(),
  });
}

export function auditLogHash(p: AuditLogPayload, prevHash: string): string {
  const payload = auditLogPayloadCanonical(p);
  return crypto.createHash("sha256").update(payload + prevHash).digest("hex");
}

export type OrderEventPayload = {
  orderId: string;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorId: string;
  payload: unknown;
  createdAt: Date;
};

export function orderEventPayloadCanonical(p: OrderEventPayload): string {
  return canonicalJson({
    orderId: p.orderId,
    type: p.type,
    fromStatus: p.fromStatus ?? null,
    toStatus: p.toStatus ?? null,
    actorId: p.actorId,
    payload: p.payload ?? null,
    createdAt: p.createdAt.toISOString(),
  });
}

export function orderEventHash(p: OrderEventPayload, prevHash: string): string {
  return crypto.createHash("sha256").update(orderEventPayloadCanonical(p) + prevHash).digest("hex");
}

// Re-export the canonicalJson for tests
export { canonicalJson };
