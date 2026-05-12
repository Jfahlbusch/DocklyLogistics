import { Prisma } from "@prisma/client";
import type { AuditAction } from "@prisma/client";
import { auditLogHash, GENESIS_PREV_HASH } from "./chain";

export type AuditInput = {
  tenantId: string;
  entity: string;
  entityId: string;
  action: AuditAction;
  actorId: string;
  actorEmail: string;
  ip?: string;
  userAgent?: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
};

/**
 * Append an audit-log entry with hash chain.
 *
 * Must be called inside a Prisma transaction so that the audit row is durable
 * iff the surrounding business change is durable.
 *
 * The chain is per-tenant: prevHash = hash of last entry of this tenant
 * (ordered by createdAt, id), or GENESIS for the first.
 *
 * `createdAt` is set explicitly to `new Date()` BEFORE we compute the hash
 * (default would let Postgres set it later, mismatching the hashed value).
 */
export async function appendAudit(
  tx: Prisma.TransactionClient,
  data: AuditInput,
): Promise<void> {
  // Fetch the previous entry's hash (last row by createdAt+id in this tenant)
  const last = await tx.auditLog.findFirst({
    where: { tenantId: data.tenantId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { hash: true },
  });
  const prevHash = last?.hash && last.hash.length === 64 ? last.hash : GENESIS_PREV_HASH;

  const createdAt = new Date();
  const before = data.before ?? null;
  const after = data.after ?? null;

  const hash = auditLogHash(
    {
      tenantId: data.tenantId,
      entity: data.entity,
      entityId: data.entityId,
      action: data.action,
      actorId: data.actorId,
      actorEmail: data.actorEmail,
      before,
      after,
      createdAt,
    },
    prevHash,
  );

  await tx.auditLog.create({
    data: {
      tenantId: data.tenantId,
      entity: data.entity,
      entityId: data.entityId,
      action: data.action,
      actorId: data.actorId,
      actorEmail: data.actorEmail,
      ip: data.ip,
      userAgent: data.userAgent,
      before: before === null ? Prisma.JsonNull : before,
      after: after === null ? Prisma.JsonNull : after,
      hash,
      prevHash,
      createdAt,
    },
  });
}
