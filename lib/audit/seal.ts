import { prisma } from "@/lib/db/client";

export type SealResult = {
  tenantId: string;
  sealDate: string;
  rootHash: string;
  entryCount: number;
  newSeal: boolean;
};

/**
 * Compute the root-hash for a tenant up to a given date (inclusive).
 * The root-hash equals the `hash` of the LAST AuditLog entry whose
 * createdAt <= endOfDay(sealDate). The entry-count is the cumulative
 * number of entries up to that point.
 *
 * If no entries exist for the tenant on/before sealDate, returns null.
 */
export async function computeRoot(
  tenantId: string,
  sealDate: string,
): Promise<{ rootHash: string; entryCount: number } | null> {
  const endOfDay = new Date(`${sealDate}T23:59:59.999Z`);
  const last = await prisma.auditLog.findFirst({
    where: { tenantId, createdAt: { lte: endOfDay } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { hash: true },
  });
  if (!last) return null;
  const entryCount = await prisma.auditLog.count({
    where: { tenantId, createdAt: { lte: endOfDay } },
  });
  return { rootHash: last.hash, entryCount };
}

/**
 * Compute the root for a tenant + date and upsert an AuditSeal row.
 * Returns the seal result. If a seal already exists, it is overwritten
 * if-and-only-if the rootHash changed (which should not happen — but
 * idempotency means re-running the sealing job is safe).
 */
export async function sealDay(
  tenantId: string,
  sealDate: string,
): Promise<SealResult | null> {
  const root = await computeRoot(tenantId, sealDate);
  if (!root) return null;

  const existing = await prisma.auditSeal.findUnique({
    where: { tenantId_sealDate: { tenantId, sealDate } },
  });

  let newSeal = false;
  if (!existing) {
    await prisma.auditSeal.create({
      data: {
        tenantId,
        sealDate,
        rootHash: root.rootHash,
        entryCount: root.entryCount,
      },
    });
    newSeal = true;
  } else if (
    existing.rootHash !== root.rootHash ||
    existing.entryCount !== root.entryCount
  ) {
    // This indicates tampering or backfill after sealing — log + overwrite.
    console.warn(
      `[seal] mismatch for tenant=${tenantId} date=${sealDate}: was ${existing.rootHash.slice(0, 12)}/${existing.entryCount} now ${root.rootHash.slice(0, 12)}/${root.entryCount}`,
    );
    await prisma.auditSeal.update({
      where: { tenantId_sealDate: { tenantId, sealDate } },
      data: {
        rootHash: root.rootHash,
        entryCount: root.entryCount,
        sealedAt: new Date(),
      },
    });
  }

  return {
    tenantId,
    sealDate,
    rootHash: root.rootHash,
    entryCount: root.entryCount,
    newSeal,
  };
}

/**
 * Seal yesterday (UTC) for every tenant that has audit entries.
 */
export async function sealYesterdayForAllTenants(): Promise<SealResult[]> {
  const yesterday = new Date(Date.now() - 86_400_000);
  const sealDate = yesterday.toISOString().slice(0, 10);

  const tenants = await prisma.auditLog.findMany({
    where: { createdAt: { lte: new Date(`${sealDate}T23:59:59.999Z`) } },
    distinct: ["tenantId"],
    select: { tenantId: true },
  });

  const out: SealResult[] = [];
  for (const t of tenants) {
    const r = await sealDay(t.tenantId, sealDate);
    if (r) out.push(r);
  }
  return out;
}
