/**
 * Mengen-Capability des Artikels (reine Funktionen, kein IO).
 * Mindest-, Maximal- und empfohlene Menge stehen in Basiseinheiten,
 * Bestellmengen in Bestelleinheiten (packFactor Basiseinheiten je Bestelleinheit).
 */

export type StockLevels = {
  minStock: number;
  targetStock?: number | null;
  maxStock?: number | null;
};

export type StockLevelError = {
  field: "minStock" | "targetStock" | "maxStock";
  message: string;
};

/** Zielmenge zum Auffüllen: empfohlene Menge, sonst die Mindestmenge. */
export function effectiveTarget(a: { minStock: number; targetStock?: number | null }): number {
  return a.targetStock ?? a.minStock;
}

/** Bestellvorschlag in Bestelleinheiten: Differenz zur Zielmenge, aufgerundet. */
export function suggestedOrderQty(
  a: { minStock: number; targetStock?: number | null; packFactor: number },
  stockTotal: number,
): number {
  const missing = Math.max(0, effectiveTarget(a) - stockTotal);
  return Math.ceil(missing / Math.max(1, a.packFactor));
}

/** true, wenn Bestand + Bestellmenge (Bestelleinheiten) die Maximalmenge übersteigt. */
export function exceedsCapacity(
  a: { maxStock?: number | null; packFactor: number },
  stockTotal: number,
  qtyOrderUnit: number,
): boolean {
  return a.maxStock != null && stockTotal + qtyOrderUnit * a.packFactor > a.maxStock;
}

/** Plausibilität: Mindestmenge ≤ empfohlene Menge ≤ Maximalmenge (nur gesetzte Werte). */
export function validateStockLevels({ minStock, targetStock, maxStock }: StockLevels): StockLevelError[] {
  const errors: StockLevelError[] = [];
  if (targetStock != null && targetStock < minStock) {
    errors.push({ field: "targetStock", message: "Die empfohlene Menge darf nicht unter der Mindestmenge liegen." });
  }
  if (targetStock != null && maxStock != null && targetStock > maxStock) {
    errors.push({ field: "targetStock", message: "Die empfohlene Menge darf die Maximalmenge nicht übersteigen." });
  }
  if (maxStock != null && minStock > maxStock) {
    errors.push({ field: "maxStock", message: "Die Maximalmenge darf nicht unter der Mindestmenge liegen." });
  }
  return errors;
}
