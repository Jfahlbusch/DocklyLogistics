"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type Summary = {
  total: number;
  totalVolume: number;
  byStatus: Record<string, { count: number; total: number }>;
};
type SupplierRow = {
  supplierId: string;
  supplierName: string;
  channel: string;
  orderCount: number;
  volume: number;
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#A8A29E",
  REVIEW: "#C9A24B",
  APPROVED: "#D6B55E",
  SENT: "#1E3A60",
  CONFIRMED: "#10B981",
  PARTIALLY_RECEIVED: "#34D399",
  RECEIVED: "#059669",
  CLOSED: "#78716C",
  CANCELLED: "#E11D48",
};

function fmtEur(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export function ReportsView({
  summary,
  bySupplier,
  yearStart,
}: {
  summary: Summary;
  bySupplier: SupplierRow[];
  yearStart: string;
}) {
  const totalSent =
    (summary.byStatus.SENT?.count ?? 0) +
    (summary.byStatus.CONFIRMED?.count ?? 0) +
    (summary.byStatus.PARTIALLY_RECEIVED?.count ?? 0) +
    (summary.byStatus.RECEIVED?.count ?? 0) +
    (summary.byStatus.CLOSED?.count ?? 0);
  const totalReceived =
    (summary.byStatus.RECEIVED?.count ?? 0) + (summary.byStatus.CLOSED?.count ?? 0);
  const cancelledCount = summary.byStatus.CANCELLED?.count ?? 0;
  const cancelRate = summary.total > 0 ? (cancelledCount / summary.total) * 100 : 0;

  const statusPie = Object.entries(summary.byStatus).map(([status, v]) => ({
    status,
    count: v.count,
    fill: STATUS_COLORS[status] ?? "#A8A29E",
  }));

  function exportCsv() {
    const from = new Date(yearStart).toISOString();
    const url = `/api/v1/reports/export.csv?from=${encodeURIComponent(from)}`;
    window.location.href = url;
  }

  return (
    <div className="space-y-6 max-w-app">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Zeitraum: seit {new Date(yearStart).toLocaleDateString("de-DE")}
          </p>
        </div>
        <Button onClick={exportCsv} variant="outline" className="text-sm">
          CSV-Export (Bestellungen)
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Bestellungen gesamt" value={String(summary.total)} />
        <Kpi label="Bestellvolumen" value={fmtEur(summary.totalVolume)} />
        <Kpi label="Versendet" value={String(totalSent)} />
        <Kpi label="Wareneingang abgeschlossen" value={String(totalReceived)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-soft">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-display text-lg text-foreground">Status-Verteilung</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Storno-Quote: {cancelRate.toFixed(1)} %
            </p>
          </div>
          <CardContent className="p-5">
            {statusPie.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">Keine Daten.</div>
            ) : (
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={statusPie}
                      dataKey="count"
                      nameKey="status"
                      outerRadius={100}
                      label={(e: unknown) => {
                        const x = e as { status?: string; count?: number };
                        return `${x.status}: ${x.count}`;
                      }}
                    >
                      {statusPie.map((s) => (
                        <Cell key={s.status} fill={s.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-display text-lg text-foreground">Volume je Lieferant</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Top {Math.min(bySupplier.length, 8)} im Zeitraum
            </p>
          </div>
          <CardContent className="p-5">
            {bySupplier.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">Keine Daten.</div>
            ) : (
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={bySupplier.slice(0, 8)}
                    margin={{ top: 8, right: 24, bottom: 16, left: 8 }}
                  >
                    <CartesianGrid stroke="#E7E5E4" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="supplierName"
                      tick={{ fontSize: 11, fill: "#78716C" }}
                      interval={0}
                      angle={-12}
                      textAnchor="end"
                      height={56}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#78716C" }}
                      tickFormatter={(v: number) => v.toLocaleString("de-DE")}
                    />
                    <Tooltip formatter={(v) => fmtEur(Number(v ?? 0))} />
                    <Legend />
                    <Bar name="Volume (EUR)" dataKey="volume" fill="#0F2A44" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-display text-lg text-foreground">Lieferanten-Tabelle</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[11px] tracking-[0.16em] uppercase text-muted-foreground">
                <th className="text-left font-medium px-4 py-3">Lieferant</th>
                <th className="text-left font-medium px-4 py-3">Kanal</th>
                <th className="text-right font-medium px-4 py-3">Bestellungen</th>
                <th className="text-right font-medium px-4 py-3">Volume</th>
              </tr>
            </thead>
            <tbody>
              {bySupplier.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-muted-foreground py-8">
                    Keine Daten.
                  </td>
                </tr>
              )}
              {bySupplier.map((s) => (
                <tr key={s.supplierId} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-foreground">{s.supplierName}</td>
                  <td className="px-4 py-3 text-xs">{s.channel}</td>
                  <td className="px-4 py-3 text-right">{s.orderCount}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmtEur(s.volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="shadow-soft">
      <CardContent className="p-5">
        <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">{label}</div>
        <div className="font-display text-3xl text-foreground mt-1.5">{value}</div>
      </CardContent>
    </Card>
  );
}
