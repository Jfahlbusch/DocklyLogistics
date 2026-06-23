"use client";

import { FlashBanner } from "@/components/ui/flash-banner";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArticleDetailModal } from "./article-detail-modal";
import { useOpenParam } from "@/lib/search/use-open-param";
import { ArticleForm, defaultArticleValues, type ArticleFormValues } from "./article-form";

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
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const closeDetail = useOpenParam(setSelected);
  const [searchValue, setSearchValue] = useState(q);
  const [creating, setCreating] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<{ ok: boolean; text: string } | null>(null);

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
          <h1 className="font-display text-2xl sm:text-3xl text-foreground">Artikel / Rohstoffe</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} Artikel · {belowMinCount} unter Mindestbestand
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => setCreating(true)}
            className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900"
          >
            + Neuer Artikel
          </Button>
        )}
      </div>

      <FlashBanner flash={createMessage} />

      <Card className="shadow-soft">
        <form
          onSubmit={onSearch}
          className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-border"
        >
          <Input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Suche nach SKU, EAN, Name…"
            className="flex-1 min-w-[200px]"
          />
          <select className="px-3 py-2 rounded-lg border border-border text-sm bg-card">
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
              <tr className="bg-muted/40 text-[11px] tracking-[0.16em] uppercase text-muted-foreground">
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
                  <td colSpan={8} className="text-center text-muted-foreground py-10">
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
                    className="border-t border-border hover:bg-muted/40 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{r.sku}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{r.name}</div>
                      {r.eanGtin && (
                        <div className="text-muted-foreground text-xs">EAN {r.eanGtin}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">{r.locationCode}</td>
                    <td className="px-4 py-3">
                      <span className={belowMin ? "text-rose-600 font-medium" : ""}>{r.stock}</span>
                    </td>
                    <td className="px-4 py-3">{r.minStock}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{r.orderUnit}</td>
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

      <ArticleDetailModal
        articleId={selected}
        role={rows[0]?.role}
        onClose={closeDetail}
      />

      <Dialog
        open={creating}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setCreateError(null);
          }
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-foreground">Neuer Artikel</DialogTitle>
            <DialogDescription>Pflichtfelder sind mit * markiert.</DialogDescription>
          </DialogHeader>
          <ArticleForm
            initial={defaultArticleValues}
            isCreate
            busy={createBusy}
            errorMessage={createError}
            onCancel={() => {
              setCreating(false);
              setCreateError(null);
            }}
            onSubmit={async (values: ArticleFormValues) => {
              setCreateBusy(true);
              setCreateError(null);
              try {
                const r = await fetch("/api/v1/articles", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(values),
                });
                const body = await r.json();
                if (r.ok) {
                  setCreateMessage({ ok: true, text: `Artikel ${values.sku} angelegt` });
                  setCreating(false);
                  startTransition(() => router.refresh());
                } else {
                  setCreateError(body.detail ?? body.title ?? "Fehler beim Anlegen");
                }
              } finally {
                setCreateBusy(false);
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
