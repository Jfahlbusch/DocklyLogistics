/**
 * Bestellstatus → 5 fachliche Diagramm-Gruppen (Design: „mehr als 5 Kategorien = falscher Chart“).
 * Farben ausschließlich Diagramm-Tokens.
 */
export type StatusGroupKey = "draft" | "sent" | "confirmed" | "received" | "cancelled";

export const STATUS_GROUPS: readonly {
  key: StatusGroupKey;
  statuses: readonly string[];
  color: string;
}[] = [
  { key: "draft", statuses: ["DRAFT", "REVIEW", "APPROVED"], color: "var(--chart-3)" },
  { key: "sent", statuses: ["SENT"], color: "var(--chart-1)" },
  { key: "confirmed", statuses: ["CONFIRMED"], color: "var(--chart-2)" },
  { key: "received", statuses: ["PARTIALLY_RECEIVED", "RECEIVED", "CLOSED"], color: "var(--chart-5)" },
  { key: "cancelled", statuses: ["CANCELLED"], color: "var(--chart-4)" },
];

export type StatusGroupResult = {
  key: StatusGroupKey;
  color: string;
  count: number;
  details: { status: string; count: number }[];
};

/** Fasst `byStatus` zu Gruppen zusammen; leere Gruppen entfallen, unbekannte Status werden ignoriert. */
export function groupStatuses(byStatus: Record<string, { count: number; total: number }>): StatusGroupResult[] {
  const out: StatusGroupResult[] = [];
  for (const g of STATUS_GROUPS) {
    const details = g.statuses
      .map((status) => ({ status, count: byStatus[status]?.count ?? 0 }))
      .filter((d) => d.count > 0);
    const count = details.reduce((a, d) => a + d.count, 0);
    if (count > 0) out.push({ key: g.key, color: g.color, count, details });
  }
  return out;
}
