"use client";

import { FlashBanner } from "@/components/ui/flash-banner";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-field";
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
  zoneName: string | null;
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
  zones,
  zoneId,
}: {
  rows: Row[];
  total: number;
  categories: string[];
  belowMinCount: number;
  canCreate: boolean;
  q: string;
  zones: { id: string; name: string }[];
  zoneId: string;
}) {
  const tz = useTranslations("articles.zone");
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const closeDetail = useOpenParam(setSelected);
  const category = sp.get("category") ?? "";
  const [searchValue, setSearchValue] = useState(q);
  const [creating, setCreating] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string[]> | null>(null);
  const [createMessage, setCreateMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(sp.toString());
    if (searchValue) params.set("q", searchValue);
    else params.delete("q");
    router.push(`/articles?${params.toString()}`);
  }

  function onCategoryChange(next: string) {
    const params = new URLSearchParams(sp.toString());
    if (next) params.set("category", next);
    else params.delete("category");
    params.delete("page");
    router.push(`/articles?${params.toString()}`);
  }

  function onZoneChange(next: string) {
    const params = new URLSearchParams(sp.toString());
    if (next) params.set("zoneId", next);
    else params.delete("zoneId");
    params.delete("page");
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
            type="search"
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 min-w-[200px]"
          />
          <select
            aria-label="Kategorie"
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            className={NATIVE_SELECT_CLASS}
          >
            <option value="">Alle Kategorien</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            data-testid="filter-zone"
            aria-label={tz("filterLabel")}
            value={zoneId}
            onChange={(e) => onZoneChange(e.target.value)}
            className={NATIVE_SELECT_CLASS}
          >
            <option value="">{tz("filterAll")}</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline">
            Suchen
          </Button>
        </form>

        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[11px] tracking-[0.16em] uppercase text-muted-foreground">
                <th className="text-left font-medium px-4 py-3">SKU</th>
                <th className="text-left font-medium px-4 py-3">Name</th>
                <th className="text-left font-medium px-4 py-3">{tz("column")}</th>
                <th className="text-left font-medium px-4 py-3">Lagerplatz</th>
                <th className="text-left font-medium px-4 py-3">Bestand</th>
                <th className="text-left font-medium px-4 py-3">Min</th>
                <th className="hidden 2xl:table-cell text-left font-medium px-4 py-3">Einheit</th>
                <th className="text-left font-medium px-4 py-3">EK</th>
                <th className="hidden 2xl:table-cell text-left font-medium px-4 py-3">Primärlieferant</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-muted-foreground py-10">
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
                    <td className="px-4 py-3" data-testid={`row-zone-${r.id}`}>{r.zoneName ?? tz("notSet")}</td>
                    <td className="px-4 py-3">{r.locationCode}</td>
                    <td className="px-4 py-3">
                      <span className={belowMin ? "text-rose-600 font-medium" : ""}>{r.stock}</span>
                      <span className="text-muted-foreground text-xs 2xl:hidden"> {r.orderUnit}</span>
                    </td>
                    <td className="px-4 py-3">{r.minStock}</td>
                    <td className="hidden 2xl:table-cell px-4 py-3 text-muted-foreground text-xs">{r.orderUnit}</td>
                    <td className="px-4 py-3">
                      {r.ek !== null ? `€ ${Number(r.ek).toFixed(2)}` : "—"}
                    </td>
                    <td className="hidden 2xl:table-cell px-4 py-3">{r.primarySupplierName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bis xl: Karten statt (zu breiter) Tabelle */}
        <div className="divide-y divide-border xl:hidden">
          {rows.length === 0 && (
            <div className="py-10 text-center text-muted-foreground">Keine Artikel gefunden.</div>
          )}
          {rows.map((r) => {
            const belowMin = r.stock < r.minStock && r.minStock > 0;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r.id)}
                className="flex min-h-11 w-full flex-col gap-1 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/40"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-foreground">{r.name}</span>
                  <span className={"shrink-0 tabular-nums " + (belowMin ? "font-medium text-rose-600" : "text-foreground")}>
                    {r.stock} {r.orderUnit}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="font-mono">{r.sku}</span>
                  <span>Min {r.minStock}</span>
                  <span data-testid={`card-zone-${r.id}`}>{r.zoneName ?? tz("notSet")}</span>
                  <span>{r.locationCode}</span>
                  {r.ek !== null && <span>EK € {Number(r.ek).toFixed(2)}</span>}
                  <span>{r.primarySupplierName}</span>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <ArticleDetailModal
        articleId={selected}
        role={rows[0]?.role}
        onClose={closeDetail}
      />

      <ResponsiveDialog
        open={creating}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setCreateError(null);
          }
        }}
      >
        <ResponsiveDialogContent size="lg">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display text-2xl text-foreground">Neuer Artikel</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Pflichtfelder sind mit * markiert.</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ArticleForm
            initial={defaultArticleValues}
            isCreate
            busy={createBusy}
            errorMessage={createError}
            fieldErrors={createFieldErrors}
            onCancel={() => {
              setCreating(false);
              setCreateError(null);
              setCreateFieldErrors(null);
            }}
            onSubmit={async (values: ArticleFormValues) => {
              setCreateBusy(true);
              setCreateError(null);
              setCreateFieldErrors(null);
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
                  if (r.status === 422 && body.errors && typeof body.errors === "object") {
                    setCreateFieldErrors(body.errors);
                  }
                  setCreateError(body.detail ?? body.title ?? "Fehler beim Anlegen");
                }
              } finally {
                setCreateBusy(false);
              }
            }}
          />
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
