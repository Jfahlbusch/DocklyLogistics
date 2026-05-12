import { prisma } from "@/lib/db/client";

export type ReportRange = { from?: Date; to?: Date };

function rangeWhere(tenantId: string, r: ReportRange) {
  return {
    tenantId,
    ...(r.from || r.to
      ? {
          createdAt: {
            ...(r.from ? { gte: r.from } : {}),
            ...(r.to ? { lte: r.to } : {}),
          },
        }
      : {}),
  };
}

export async function summary(tenantId: string, range: ReportRange = {}) {
  const where = rangeWhere(tenantId, range);
  const grouped = await prisma.order.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
    _sum: { total: true },
  });
  const byStatus: Record<string, { count: number; total: number }> = {};
  for (const g of grouped) {
    byStatus[g.status] = { count: g._count._all, total: Number(g._sum.total ?? 0) };
  }
  const all = await prisma.order.aggregate({
    where,
    _count: { _all: true },
    _sum: { total: true },
  });
  return {
    total: all._count._all,
    totalVolume: Number(all._sum.total ?? 0),
    byStatus,
  };
}

export async function bySupplier(tenantId: string, range: ReportRange = {}) {
  const where = rangeWhere(tenantId, range);
  const grouped = await prisma.order.groupBy({
    by: ["supplierId"],
    where,
    _count: { _all: true },
    _sum: { total: true },
    orderBy: { _sum: { total: "desc" } },
  });
  if (grouped.length === 0) return [];
  const ids = grouped.map((g) => g.supplierId);
  const suppliers = await prisma.supplier.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, channel: true },
  });
  const byId = new Map(suppliers.map((s) => [s.id, s]));
  return grouped.map((g) => ({
    supplierId: g.supplierId,
    supplierName: byId.get(g.supplierId)?.name ?? "—",
    channel: byId.get(g.supplierId)?.channel ?? "EMAIL",
    orderCount: g._count._all,
    volume: Number(g._sum.total ?? 0),
  }));
}

/**
 * Flat row list for CSV/XLSX export.
 */
export async function orderRows(tenantId: string, range: ReportRange = {}) {
  const where = rangeWhere(tenantId, range);
  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: { supplier: { select: { name: true, channel: true } } },
  });
  return orders.map((o) => ({
    orderNo: o.orderNo,
    status: o.status,
    supplier: o.supplier.name,
    channel: o.supplier.channel,
    total: Number(o.total).toFixed(2),
    currency: o.currency,
    createdAt: o.createdAt.toISOString(),
    sentAt: o.sentAt?.toISOString() ?? "",
    confirmedAt: o.confirmedAt?.toISOString() ?? "",
    cancelledAt: o.cancelledAt?.toISOString() ?? "",
  }));
}

/**
 * Serialize order rows as CSV (RFC-4180-ish). UTF-8 BOM for Excel compatibility.
 */
export function toCsv(rows: Array<Record<string, string | number>>): string {
  if (rows.length === 0)
    return "﻿orderNo;status;supplier;channel;total;currency;createdAt;sentAt;confirmedAt;cancelledAt\n";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(";")];
  for (const r of rows)
    lines.push(headers.map((h) => escape((r as Record<string, unknown>)[h])).join(";"));
  return "﻿" + lines.join("\n");
}
