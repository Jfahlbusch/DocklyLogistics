"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Location = {
  id: string; code: string; name: string; zone: string;
  capacity: number | null; used: number;
};
type ArticleRow = {
  id: string; sku: string; name: string; locationCode: string;
  stock: number; minStock: number;
};

const ZONE_STYLES: Record<string, string> = {
  "Trocken": "bg-stone-100 text-stone-700",
  "Kühl":    "bg-navy-100 text-navy-900",
};

export function StockView({
  locations, articles, totalUnits,
}: { locations: Location[]; articles: ArticleRow[]; totalUnits: number }) {
  return (
    <div className="space-y-4 max-w-app">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-navy-900">Lager & Bestand</h1>
          <p className="text-sm text-stone-500 mt-1">
            {locations.length} Lagerplätze · {totalUnits} Einheiten eingelagert (Phase M2-Placeholder; reale Bestände in M3)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="text-sm" disabled title="Anlage über die API (Scalar) oder in M2-Final">
            + Lagerplatz
          </Button>
          <Button className="bg-navy-900 hover:bg-navy-700 text-white text-sm" disabled title="Inventur-Workflow kommt in M3">
            Inventur starten
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Lagerplätze */}
        <Card className="shadow-soft">
          <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
            <h2 className="font-display text-lg text-navy-900">Lagerplätze</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 text-[11px] tracking-[0.16em] uppercase text-stone-500">
                  <th className="text-left font-medium px-4 py-3">Code</th>
                  <th className="text-left font-medium px-4 py-3">Name</th>
                  <th className="text-left font-medium px-4 py-3">Zone</th>
                  <th className="text-left font-medium px-4 py-3">Belegung</th>
                </tr>
              </thead>
              <tbody>
                {locations.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-stone-500 py-8">Keine Lagerplätze.</td></tr>
                )}
                {locations.map((l) => {
                  const pct = l.capacity && l.capacity > 0 ? Math.round((l.used / l.capacity) * 100) : 0;
                  const barClass =
                    pct >= 95 ? "bg-rose-600" :
                    pct >= 70 ? "bg-gold-500" :
                                "bg-navy-900";
                  return (
                    <tr key={l.id} className="border-t border-stone-100">
                      <td className="px-4 py-3 font-mono text-xs">{l.code}</td>
                      <td className="px-4 py-3 text-stone-700">{l.name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${ZONE_STYLES[l.zone] ?? "bg-stone-100 text-stone-700"}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                          {l.zone}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-[80px] h-2 bg-stone-100 rounded-full overflow-hidden">
                            <div className={`h-full ${barClass}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-stone-500 text-xs w-16 text-right tabular-nums">
                            {l.used}/{l.capacity ?? "—"}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Bestände je Artikel */}
        <Card className="shadow-soft">
          <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
            <h2 className="font-display text-lg text-navy-900">Bestände je Artikel</h2>
            <span className="text-[11px] text-stone-500">Reale Daten in Phase M3</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 text-[11px] tracking-[0.16em] uppercase text-stone-500">
                  <th className="text-left font-medium px-4 py-3">Artikel</th>
                  <th className="text-left font-medium px-4 py-3">Platz</th>
                  <th className="text-left font-medium px-4 py-3">Bestand</th>
                  <th className="text-left font-medium px-4 py-3">Min</th>
                </tr>
              </thead>
              <tbody>
                {articles.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-stone-500 py-8">Keine Artikel.</td></tr>
                )}
                {articles.map((a) => {
                  const belowMin = a.stock < a.minStock && a.minStock > 0;
                  return (
                    <tr key={a.id} className="border-t border-stone-100">
                      <td className="px-4 py-3">
                        <div className="font-medium text-navy-900">{a.name}</div>
                        <div className="text-stone-500 font-mono text-xs">{a.sku}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{a.locationCode}</td>
                      <td className="px-4 py-3"><span className={belowMin ? "text-rose-600 font-medium" : ""}>{a.stock}</span></td>
                      <td className="px-4 py-3">{a.minStock}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
