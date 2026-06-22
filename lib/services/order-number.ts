import type { Prisma } from "@prisma/client";

/**
 * Generates the next OrderNo for the given tenant + year via SQL advisory lock + count.
 * Format: `ORD-YYYY-NNNN` (4-digit running counter, restarts per year).
 * Counter is computed by counting existing orders for this tenant+year.
 */
export async function nextOrderNo(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const yearPrefix = `ORD-${year}-`;

  // Serialize concurrent order-number generation per tenant+year with a
  // transaction-scoped advisory lock (auto-released on commit/rollback). Without
  // it, two parallel creates could read the same last number and collide on the
  // unique orderNo — `findFirst` does NOT lock rows, so the lock must be explicit.
  // $executeRaw (not $queryRaw): pg_advisory_xact_lock returns void, which $queryRaw
  // cannot deserialize. $executeRaw just runs the statement.
  const lockKey = `ordno:${tenantId}:${year}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey})::bigint)`;

  const lastOrder = await tx.order.findFirst({
    where: { tenantId, orderNo: { startsWith: yearPrefix } },
    orderBy: { orderNo: "desc" },
    select: { orderNo: true },
  });
  let next = 1;
  if (lastOrder) {
    const tail = lastOrder.orderNo.slice(yearPrefix.length);
    const parsed = parseInt(tail, 10);
    if (!isNaN(parsed)) next = parsed + 1;
  }
  return `${yearPrefix}${String(next).padStart(4, "0")}`;
}
