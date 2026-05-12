import { Prisma } from "@prisma/client";
import type { AuditAction } from "@prisma/client";

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
 * Append an audit-log entry. Must be called inside a Prisma transaction so that
 * the audit row is durable iff the surrounding business change is durable.
 *
 * In Phase M2 the hash-chain fields are stub-filled with "" — real hash-chain
 * with verification arrives in Phase M6.
 */
export async function appendAudit(
  tx: Prisma.TransactionClient,
  data: AuditInput,
): Promise<void> {
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
      before: data.before ?? Prisma.JsonNull,
      after: data.after ?? Prisma.JsonNull,
      hash: "",
      prevHash: "",
    },
  });
}
