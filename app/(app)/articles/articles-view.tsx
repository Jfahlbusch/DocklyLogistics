"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArticleDetailModal } from "./article-detail-modal";

type Row = {
  id: string;
  sku: string;
  name: string;
  eanGtin: string | null;
  category: string | null;
  locationCode: string;
  stock: number;
  minStock: number;
  orderUnit: string;
  ek: string | null;
  primarySupplierName: string;
  role: string;
};

export function ArticlesView({
  rows,
  total,
  categories,
  belowMinCount,
  canCreate,
  q,
}: {
  rows: Row[];
  total: number;
  categories: string[];
  belowMinCount: number;
  canCreate: boolean;
  q: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [selected, setSelected] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState(q);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(sp.toString());
    if (searchValue) params.set("q", searchValue);
    else params.delete("q");
    router.push(`/articles?${params.toString()}`);
  }

  return (
    <div className="space-y-4 max-w-app">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-navy-900">Artikel / Rohstoffe</h1>
          <p className="text-sm text-stone-500 mt-1">
            {total} Artikel · {belowMinCount} unter Mindestbestand
          </p>
        </div>
        {canCreate && (
          <Button
            className="bg-navy-900 hover:bg-navy-700 text-white"
            disabled
            title="Neue Artikel anlegen kommt in M2-Final"
          >
            + Neuer Artikel
          </Button>
        )}
      </div>

      <Card className="shadow-soft">
        <form
          onSubmit={onSearch}
          className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-stone-200"
        >
          <Input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Suche nach SKU, EAN, Name…"
            className="flex-1 min-w-[200px]"
          />
          <select className="px-3 py-2 rounded-lg border border-stone-200 text-sm bg-white">
            <option>Alle Kategorien</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <Button type="submit" variant="outline" className="text-sm">
            Suchen
          </Button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 text-[11px] tracking-[0.16em] uppercase text-stone-500">
                <th className="text-left font-medium px-4 py-3">SKU</th>
                <th className="text-left font-medium px-4 py-3">Name</th>
                <th className="text-left font-medium px-4 py-3">Lagerplatz</th>
                <th className="text-left font-medium px-4 py-3">Bestand</th>
                <th className="text-left font-medium px-4 py-3">Min</th>
                <th className="text-left font-medium px-4 py-3">Einheit</th>
                <th className="text-left font-medium px-4 py-3">EK</th>
                <th className="text-left font-medium px-4 py-3">Primärlieferant</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-stone-500 py-10">
                    Keine Artikel gefunden.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const belowMin = r.stock < r.minStock && r.minStock > 0;
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r.id)}
                    className="border-t border-stone-100 hover:bg-stone-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{r.sku}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-navy-900">{r.name}</div>
                      {r.eanGtin && (
                        <div className="text-stone-500 text-xs">EAN {r.eanGtin}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">{r.locationCode}</td>
                    <td className="px-4 py-3">
                      <span className={belowMin ? "text-rose-600 font-medium" : ""}>{r.stock}</span>
                    </td>
                    <td className="px-4 py-3">{r.minStock}</td>
                    <td className="px-4 py-3 text-stone-500 text-xs">{r.orderUnit}</td>
                    <td className="px-4 py-3">
                      {r.ek !== null ? `€ ${Number(r.ek).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3">{r.primarySupplierName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <ArticleDetailModal articleId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
