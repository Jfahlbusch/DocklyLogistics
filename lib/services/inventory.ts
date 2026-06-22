import type { Prisma } from "@prisma/client";
import { stockRepo } from "@/lib/db/repos/stock";

export type InventoryCount = { articleId: string; countedQty: number };
export type InventoryAdjustment = { articleId: string; before: number; counted: number; delta: number };

/**
 * Posts a stocktake (Inventur) for one location: for each counted article, books a
 * StockMovement (reason INVENTORY) with the delta between counted and current
 * balance, so the balance becomes exactly the counted quantity. Articles whose
 * count equals the current balance are skipped (no zero-delta movements). The
 * counted quantity is the absolute new value (>= 0), so the balance never goes
 * negative. Must run inside a transaction (StockMovement + balance commit together).
 */
export async function postInventory(
  tx: Prisma.TransactionClient,
  args: { tenantId: string; locationId: string; counts: InventoryCount[]; createdBy: string },
): Promise<InventoryAdjustment[]> {
  const adjustments: InventoryAdjustment[] = [];
  for (const c of args.counts) {
    if (c.countedQty < 0) continue;
    const balance = await tx.stockBalance.findFirst({
      where: { tenantId: args.tenantId, articleId: c.articleId, locationId: args.locationId },
    });
    const before = balance?.quantity ?? 0;
    const delta = c.countedQty - before;
    if (delta === 0) continue;
    await stockRepo.applyDelta(tx, {
      tenantId: args.tenantId,
      articleId: c.articleId,
      locationId: args.locationId,
      delta,
      reason: "INVENTORY",
      note: "Inventur-Korrektur",
      createdBy: args.createdBy,
    });
    adjustments.push({ articleId: c.articleId, before, counted: c.countedQty, delta });
  }
  return adjustments;
}
