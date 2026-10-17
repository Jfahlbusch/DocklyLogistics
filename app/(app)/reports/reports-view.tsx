"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { groupStatuses } from "@/lib/reports/status-groups";
import { MD_QUERY, useMediaQuery } from "@/hooks/use-media-query";
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
  LabelList,
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

/** Tooltip-Stil der Balkendiagramme: nur Theme-Tokens (hell/dunkel). */
const BAR_TOOLTIP = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--popover-foreground)",
    fontSize: 12,
  },
  labelStyle: { color: "var(--popover-foreground)" },
  itemStyle: { color: "var(--muted-foreground)" },
  cursor: { fill: "var(--muted)" },
} as const;

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
  const t = useTranslations("reports");
  const isDesktop = useMediaQuery(MD_QUERY, true);
  const topSuppliers = bySupplier.slice(0, 8);
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

  const statusPie = groupStatuses(summary.byStatus).map((g) => ({
    ...g,
    name: t(`statusGroups.${g.key}`),
    fill: g.color,
    breakdown:
      g.details.length > 1
        ? t("breakdown", {
            details: g.details.map((d) => `${t(`statuses.${d.status}` as "statuses.DRAFT")} ${d.count}`).join(", "),
          })
        : null,
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
          <h1 className="font-display text-2xl sm:text-3xl text-foreground">Reports</h1>
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
              <>
              <div style={{ width: "100%", height: isDesktop ? 280 : 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={statusPie}
                      dataKey="count"
                      nameKey="name"
                      outerRadius={isDesktop ? 100 : 80}
                      label={
                        isDesktop
                          ? (e: unknown) => {
                              const x = e as { name?: string; count?: number };
                              return `${x.name}: ${x.count}`;
                            }
                          : false
                      }
                    >
                      {statusPie.map((s) => (
                        <Cell key={s.key} fill={s.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<StatusTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Mobil: Legende mit Werten statt Außen-Labels */}
              <ul data-slot="status-legend" className="mt-3 space-y-1.5 text-sm md:hidden">
                {statusPie.map((s) => (
                  <li key={s.key}>
                    <div className="flex items-center gap-2">
                      <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: s.fill }} aria-hidden="true" />
                      <span className="flex-1 text-foreground">{s.name}</span>
                      <span className="font-medium">{s.count}</span>
                    </div>
                    {s.breakdown && <div className="ml-5 text-xs text-muted-foreground">{s.breakdown}</div>}
                  </li>
                ))}
              </ul>
              </>
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
              <div style={{ width: "100%", height: isDesktop ? 280 : Math.max(220, topSuppliers.length * 44 + 40) }}>
                <ResponsiveContainer>
                  {isDesktop ? (
                    <BarChart
                      data={topSuppliers}
                      margin={{ top: 8, right: 24, bottom: 16, left: 8 }}
                    >
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="supplierName"
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        interval={0}
                        angle={-12}
                        textAnchor="end"
                        height={56}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        tickFormatter={(v: number) => v.toLocaleString("de-DE")}
                      />
                      <Tooltip {...BAR_TOOLTIP} formatter={(v) => fmtEur(Number(v ?? 0))} />
                      <Legend formatter={(v) => <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{v}</span>} />
                      <Bar name="Volume (EUR)" dataKey="volume" fill="var(--chart-1)" />
                    </BarChart>
                  ) : (
                    <BarChart
                      layout="vertical"
                      data={topSuppliers}
                      margin={{ top: 4, right: 56, bottom: 4, left: 0 }}
                    >
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="supplierName"
                        width={96}
                        interval={0}
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      />
                      <Tooltip {...BAR_TOOLTIP} formatter={(v) => fmtEur(Number(v ?? 0))} />
                      <Bar name="Volume (EUR)" dataKey="volume" fill="var(--chart-1)">
                        <LabelList
                          dataKey="volume"
                          position="right"
                          formatter={(v: unknown) => Number(v ?? 0).toLocaleString("de-DE")}
                          style={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        />
                      </Bar>
                    </BarChart>
                  )}
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
        <div className="hidden md:block">
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

        {/* Mobil: Karten statt Tabelle */}
        <div data-slot="supplier-cards" className="divide-y divide-border md:hidden">
          {bySupplier.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">Keine Daten.</div>
          )}
          {bySupplier.map((s) => (
            <div key={s.supplierId} className="space-y-1 px-4 py-3 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-foreground">{s.supplierName}</span>
                <span className="shrink-0 font-medium">{fmtEur(s.volume)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {s.channel} · {s.orderCount} Bestellungen
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

type TooltipPayload = { payload?: { name: string; count: number; breakdown: string | null } };

/** Tooltip nur mit Tokens: Gruppe, Summe und Aufschlüsselung je Status. */
function StatusTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-soft">
      <div className="font-medium">
        {p.name} {p.count}
      </div>
      {p.breakdown && <div className="text-muted-foreground">{p.breakdown}</div>}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="shadow-soft">
      <CardContent className="p-5">
        <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">{label}</div>
        <div className="font-display text-2xl sm:text-3xl text-foreground mt-1.5">{value}</div>
      </CardContent>
    </Card>
  );
}
