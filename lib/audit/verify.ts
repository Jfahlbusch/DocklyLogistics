import { prisma } from "@/lib/db/client";
import { auditLogHash, GENESIS_PREV_HASH } from "./chain";

export type VerifyResult = {
  ok: boolean;
  tenantId: string;
  sealDate: string;
  entryCount: number;
  rootHash: string | null;
  storedSealRoot: string | null;
  storedSealCount: number | null;
  firstMismatchAt: { id: string; createdAt: string } | null;
  reason?: string;
};

/**
 * Verify the AuditLog hash chain for a tenant up to a given date.
 * Returns ok=true when the recomputed chain matches every stored hash,
 * AND (if an AuditSeal exists) the recomputed root matches the stored seal.
 */
export async function verifyChain(
  tenantId: string,
  sealDate: string,
): Promise<VerifyResult> {
  const endOfDay = new Date(`${sealDate}T23:59:59.999Z`);
  const rows = await prisma.auditLog.findMany({
    where: { tenantId, createdAt: { lte: endOfDay } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  let prev = GENESIS_PREV_HASH;
  let firstMismatchAt: VerifyResult["firstMismatchAt"] = null;

  for (const r of rows) {
    if (r.prevHash !== prev) {
      firstMismatchAt = { id: r.id, createdAt: r.createdAt.toISOString() };
      break;
    }
    const recomputed = auditLogHash(
      {
        tenantId: r.tenantId,
        entity: r.entity,
        entityId: r.entityId,
        action: r.action,
        actorId: r.actorId,
        actorEmail: r.actorEmail,
        before: r.before,
        after: r.after,
        createdAt: r.createdAt,
      },
      prev,
    );
    if (recomputed !== r.hash) {
      firstMismatchAt = { id: r.id, createdAt: r.createdAt.toISOString() };
      break;
    }
    prev = r.hash;
  }

  const rootHash =
    rows.length === 0 ? null : firstMismatchAt ? null : prev;

  const storedSeal = await prisma.auditSeal.findUnique({
    where: { tenantId_sealDate: { tenantId, sealDate } },
  });
  const storedSealRoot = storedSeal?.rootHash ?? null;
  const storedSealCount = storedSeal?.entryCount ?? null;

  let ok = firstMismatchAt === null;
  let reason: string | undefined;
  if (ok && storedSeal) {
    if (storedSeal.rootHash !== rootHash) {
      ok = false;
      reason = "Tages-Root-Hash stimmt nicht mit Seal überein";
    } else if (storedSeal.entryCount !== rows.length) {
      ok = false;
      reason = "Entry-Count stimmt nicht mit Seal überein";
    }
  } else if (!ok) {
    reason = "Chain-Bruch — siehe firstMismatchAt";
  }

  return {
    ok,
    tenantId,
    sealDate,
    entryCount: rows.length,
    rootHash,
    storedSealRoot,
    storedSealCount,
    firstMismatchAt,
    reason,
  };
}
