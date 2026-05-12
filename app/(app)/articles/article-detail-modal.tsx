"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArticleForm, type ArticleFormValues } from "./article-form";

type Article = {
  id: string;
  sku: string;
  name: string;
  shortDesc: string | null;
  longDesc: string | null;
  category: string | null;
  eanGtin: string | null;
  baseUnit: string;
  orderUnit: string;
  packFactor: number;
  barcodeSource: string;
  minStock: number;
  defaultLocationId: string | null;
  vatRate: string | null;
};

type ArticleSupplierLink = {
  id: string;
  isPrimary: boolean;
  purchasePrice: string;
  currency: string;
  leadTimeDays: number;
  minOrderQty: number;
  supplierSku: string | null;
  supplier: { id: string; name: string; channel: string; city: string | null };
};

type BarcodeResult = { format: string; value: string; svg: string; pngBase64: string };

export function ArticleDetailModal({
  articleId,
  role,
  onClose,
}: {
  articleId: string | null;
  role?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const open = articleId !== null;
  const [article, setArticle] = useState<Article | null>(null);
  const [suppliers, setSuppliers] = useState<ArticleSupplierLink[]>([]);
  const [barcode, setBarcode] = useState<BarcodeResult | null>(null);
  const [barcodeFormat, setBarcodeFormat] = useState<"code128" | "ean13">("code128");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const canEdit = role === "USER" || role === "MANAGER" || role === "GLOBAL_ADMIN";
  const canDelete = role === "MANAGER" || role === "GLOBAL_ADMIN";

  useEffect(() => {
    if (!articleId) {
      setArticle(null);
      setSuppliers([]);
      setBarcode(null);
      setEditing(false);
      setEditError(null);
      return;
    }
    setLoading(true);
    (async () => {
      const [aRes, sRes] = await Promise.all([
        fetch(`/api/v1/articles/${articleId}`).then((r) => r.json()),
        fetch(`/api/v1/articles/${articleId}/suppliers`).then((r) => r.json()),
      ]);
      setArticle(aRes?.data ?? null);
      setSuppliers(sRes?.data ?? []);
      setLoading(false);
    })();
  }, [articleId]);

  async function generateBarcode(format: "code128" | "ean13") {
    if (!articleId) return;
    setBarcodeFormat(format);
    setBarcode(null);
    const source = format === "ean13" ? "EAN" : "SKU";
    const r = await fetch(`/api/v1/articles/${articleId}/barcode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format, source }),
    });
    const body = await r.json();
    if (r.ok) setBarcode(body.data);
    else setBarcode(null);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl sm:max-w-3xl">
        {loading || !article ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>Artikel-Detail wird geladen</DialogTitle>
            </DialogHeader>
            <div className="py-10 text-center text-stone-500">Lade…</div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="text-[11px] tracking-[0.18em] uppercase text-stone-500 font-mono">
                {article.sku}
              </div>
              <DialogTitle className="font-display text-2xl text-navy-900">
                {article.name}
              </DialogTitle>
              {article.shortDesc && <DialogDescription>{article.shortDesc}</DialogDescription>}
            </DialogHeader>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
              <Kpi label="Kategorie" value={article.category ?? "—"} />
              <Kpi label="Basiseinheit" value={article.baseUnit} />
              <Kpi label="Bestelleinheit" value={article.orderUnit} />
              <Kpi label="Mindestbestand" value={String(article.minStock)} />
            </div>

            {!editing && (
              <Tabs defaultValue="stamm">
              <TabsList>
                <TabsTrigger value="stamm">Stamm</TabsTrigger>
                <TabsTrigger value="suppliers">Lieferanten ({suppliers.length})</TabsTrigger>
                <TabsTrigger value="barcode">Barcode</TabsTrigger>
                <TabsTrigger value="stock">Bestand</TabsTrigger>
              </TabsList>

              <TabsContent value="stamm" className="space-y-2 text-sm">
                <Field label="SKU" value={article.sku} mono />
                <Field label="EAN/GTIN" value={article.eanGtin ?? "—"} mono />
                <Field label="Kategorie" value={article.category ?? "—"} />
                <Field
                  label="Verpackungsfaktor"
                  value={`${article.packFactor} ${article.baseUnit} / ${article.orderUnit}`}
                />
                <Field label="Mindestbestand" value={String(article.minStock)} />
                {article.longDesc && <Field label="Beschreibung" value={article.longDesc} />}
              </TabsContent>

              <TabsContent value="suppliers">
                {suppliers.length === 0 && (
                  <div className="text-stone-500 text-sm py-4">
                    Noch keine Lieferanten zugeordnet.
                  </div>
                )}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] tracking-[0.16em] uppercase text-stone-500 bg-stone-50">
                      <th className="text-left p-2">Lieferant</th>
                      <th className="text-left p-2">Kanal</th>
                      <th className="text-left p-2">EK</th>
                      <th className="text-left p-2">Lieferzeit</th>
                      <th className="text-left p-2">Primary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((l) => (
                      <tr key={l.id} className="border-t border-stone-100">
                        <td className="p-2">
                          <div className="font-medium text-navy-900">{l.supplier.name}</div>
                          {l.supplier.city && (
                            <div className="text-xs text-stone-500">{l.supplier.city}</div>
                          )}
                        </td>
                        <td className="p-2">
                          <Badge variant="secondary">{l.supplier.channel}</Badge>
                        </td>
                        <td className="p-2">
                          € {Number(l.purchasePrice).toFixed(2)} {l.currency}
                        </td>
                        <td className="p-2">{l.leadTimeDays} Tage</td>
                        <td className="p-2">
                          {l.isPrimary && (
                            <Badge className="bg-gold-500 text-navy-900 hover:bg-gold-400">
                              primär
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabsContent>

              <TabsContent value="barcode" className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={barcodeFormat === "code128" ? "default" : "outline"}
                    onClick={() => generateBarcode("code128")}
                    className={
                      barcodeFormat === "code128"
                        ? "bg-navy-900 hover:bg-navy-700 text-white"
                        : ""
                    }
                  >
                    Code-128 aus SKU
                  </Button>
                  <Button
                    variant={barcodeFormat === "ean13" ? "default" : "outline"}
                    onClick={() => generateBarcode("ean13")}
                    disabled={!article.eanGtin}
                    title={!article.eanGtin ? "Artikel hat keine EAN" : undefined}
                    className={
                      barcodeFormat === "ean13" ? "bg-navy-900 hover:bg-navy-700 text-white" : ""
                    }
                  >
                    EAN-13
                  </Button>
                </div>
                {!barcode && (
                  <div className="text-stone-500 text-sm">
                    Format wählen, um Barcode zu generieren.
                  </div>
                )}
                {barcode && (
                  <div className="border border-stone-200 rounded-xl p-6 bg-white flex flex-col items-center gap-4">
                    <div className="text-[11px] tracking-[0.18em] uppercase text-stone-500">
                      {barcode.format === "code128" ? "Code-128" : "EAN-13"}
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:image/png;base64,${barcode.pngBase64}`}
                      alt={`Barcode ${barcode.value}`}
                      className="max-w-full h-auto"
                      style={{ minHeight: "80px", imageRendering: "pixelated" }}
                    />
                    <div className="text-sm font-mono tracking-widest text-stone-900">{barcode.value}</div>
                    <div className="flex flex-wrap gap-3 pt-2 text-xs">
                      <a
                        href={`data:image/png;base64,${barcode.pngBase64}`}
                        download={`${article.sku}-${barcode.format}.png`}
                        className="text-navy-900 underline hover:text-navy-700"
                      >
                        PNG herunterladen
                      </a>
                      <a
                        href={`data:image/svg+xml;utf8,${encodeURIComponent(barcode.svg)}`}
                        download={`${article.sku}-${barcode.format}.svg`}
                        className="text-navy-900 underline hover:text-navy-700"
                      >
                        SVG herunterladen
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          const w = window.open("", "_blank", "width=480,height=320");
                          if (!w) return;
                          w.document.write(
                            `<html><head><title>${article.sku} — ${barcode.format}</title>` +
                            `<style>body{font-family:system-ui,sans-serif;margin:32px;text-align:center}` +
                            `img{max-width:100%;height:auto;image-rendering:pixelated}` +
                            `h2{font-size:14px;letter-spacing:.18em;text-transform:uppercase;color:#78716C;margin:0 0 8px 0}` +
                            `.code{font-family:ui-monospace,monospace;letter-spacing:.2em;color:#0F2A44;margin-top:8px}` +
                            `@media print{button{display:none}}</style></head><body>` +
                            `<h2>${article.sku} — ${article.name}</h2>` +
                            `<img src="data:image/png;base64,${barcode.pngBase64}" alt="${barcode.value}"/>` +
                            `<div class="code">${barcode.value}</div>` +
                            `<button onclick="window.print()" style="margin-top:24px;padding:8px 16px">Drucken</button>` +
                            `</body></html>`,
                          );
                          w.document.close();
                        }}
                        className="text-navy-900 underline hover:text-navy-700"
                      >
                        Drucken
                      </button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="stock" className="space-y-3">
                <StockPanel articleId={article.id} minStock={article.minStock} baseUnit={article.baseUnit} />
              </TabsContent>
            </Tabs>
            )}

            {editing && article && (
              <ArticleForm
                initial={articleToFormValues(article)}
                isCreate={false}
                busy={editBusy}
                errorMessage={editError}
                onCancel={() => {
                  setEditing(false);
                  setEditError(null);
                }}
                onSubmit={async (values) => {
                  setEditBusy(true);
                  setEditError(null);
                  try {
                    // Strip sku from PATCH (immutable per UX); also strip empty optionals.
                    const { sku: _sku, ...patch } = values;
                    void _sku;
                    const r = await fetch(`/api/v1/articles/${article.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(patch),
                    });
                    const body = await r.json();
                    if (r.ok) {
                      setEditing(false);
                      // Refetch the article to update tabs
                      const fresh = await fetch(`/api/v1/articles/${article.id}`).then((res) => res.json());
                      setArticle(fresh?.data ?? null);
                      router.refresh();
                    } else {
                      setEditError(body.detail ?? body.title ?? "Fehler beim Speichern");
                    }
                  } finally {
                    setEditBusy(false);
                  }
                }}
              />
            )}

            {!editing && article && (canEdit || canDelete) && (
              <div className="flex justify-end gap-2 pt-4 border-t border-stone-100">
                {canDelete && (
                  <Button
                    variant="outline"
                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                    onClick={async () => {
                      if (!confirm(`Artikel "${article.name}" (${article.sku}) wirklich löschen?`)) return;
                      const r = await fetch(`/api/v1/articles/${article.id}`, { method: "DELETE" });
                      if (r.status === 204) {
                        onClose();
                        router.refresh();
                      } else {
                        const body = await r.json().catch(() => ({}));
                        alert(body.detail ?? body.title ?? "Löschen fehlgeschlagen");
                      }
                    }}
                  >
                    Löschen
                  </Button>
                )}
                {canEdit && (
                  <Button
                    onClick={() => setEditing(true)}
                    className="bg-navy-900 hover:bg-navy-700 text-white"
                  >
                    Bearbeiten
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function articleToFormValues(a: Article): ArticleFormValues {
  return {
    sku: a.sku,
    name: a.name,
    shortDesc: a.shortDesc ?? undefined,
    longDesc: a.longDesc ?? undefined,
    category: a.category ?? undefined,
    eanGtin: a.eanGtin ?? undefined,
    baseUnit: a.baseUnit as ArticleFormValues["baseUnit"],
    orderUnit: a.orderUnit as ArticleFormValues["orderUnit"],
    packFactor: a.packFactor,
    barcodeSource: a.barcodeSource as ArticleFormValues["barcodeSource"],
    minStock: a.minStock,
    defaultLocationId: a.defaultLocationId ?? undefined,
    vatRate: a.vatRate === null ? undefined : Number(a.vatRate),
  };
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-stone-200 rounded-xl px-4 py-3">
      <div className="text-[11px] tracking-[0.18em] uppercase text-stone-500">{label}</div>
      <div className="font-medium text-navy-900 mt-1">{value}</div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2 items-baseline">
      <div className="text-[11px] tracking-[0.18em] uppercase text-stone-500 w-44 flex-shrink-0">
        {label}
      </div>
      <div className={mono ? "font-mono" : ""}>{value}</div>
    </div>
  );
}

type StockRow = {
  id: string;
  quantity: number;
  location: { code: string; name: string; zone: string | null };
};
type HistoryRow = {
  id: string;
  delta: number;
  reason: string;
  refType: string | null;
  note: string | null;
  createdAt: string;
  createdBy: string;
  location: { code: string; name: string };
};

function StockPanel({ articleId, minStock, baseUnit }: { articleId: string; minStock: number; baseUnit: string }) {
  const [balances, setBalances] = useState<StockRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/v1/stock?articleId=${articleId}&pageSize=200`).then((r) => r.json()),
      fetch(`/api/v1/stock/${articleId}/history?pageSize=15`).then((r) => r.json()),
    ]).then(([bRes, hRes]) => {
      if (cancelled) return;
      setBalances(bRes?.data ?? []);
      setHistory(hRes?.data ?? []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [articleId]);

  const total = balances.reduce((s, b) => s + b.quantity, 0);
  const shortfall = Math.max(0, minStock - total);

  if (loading) return <div className="py-6 text-center text-stone-500 text-sm">Lade Bestand…</div>;

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Gesamtbestand" value={`${total} ${baseUnit}`} />
        <Kpi label="Mindestbestand" value={`${minStock} ${baseUnit}`} />
        <div className={"border rounded-xl px-4 py-3 " + (shortfall > 0 ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50")}>
          <div className="text-[11px] tracking-[0.18em] uppercase text-stone-500">Unterdeckung</div>
          <div className={"font-medium mt-1 " + (shortfall > 0 ? "text-rose-700" : "text-emerald-700")}>{shortfall} {baseUnit}</div>
        </div>
      </div>

      <div className="border border-stone-200 rounded-xl overflow-hidden">
        <div className="bg-stone-50 px-4 py-2 text-[11px] tracking-[0.16em] uppercase text-stone-500">Bestand pro Lagerplatz</div>
        {balances.length === 0 ? (
          <div className="px-4 py-4 text-stone-500 text-sm">Kein Bestand eingebucht.</div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {balances.map((b) => (
              <li key={b.id} className="px-4 py-2 flex items-center justify-between text-sm">
                <div>
                  <span className="font-mono text-xs">{b.location.code}</span>
                  <span className="text-stone-500 ml-2">{b.location.name}</span>
                  {b.location.zone && <span className="text-stone-400 text-xs ml-2">· {b.location.zone}</span>}
                </div>
                <div className="font-medium">{b.quantity} {baseUnit}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border border-stone-200 rounded-xl overflow-hidden">
        <div className="bg-stone-50 px-4 py-2 text-[11px] tracking-[0.16em] uppercase text-stone-500">Letzte Bewegungen</div>
        {history.length === 0 ? (
          <div className="px-4 py-4 text-stone-500 text-sm">Keine Bewegungen.</div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {history.map((h) => (
              <li key={h.id} className="px-4 py-2 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={"font-medium " + (h.delta >= 0 ? "text-emerald-700" : "text-rose-700")}>
                      {h.delta >= 0 ? "+" : ""}{h.delta} {baseUnit}
                    </span>
                    <span className="text-stone-500 text-xs">{h.reason}</span>
                    {h.refType && <span className="text-stone-400 text-xs">· {h.refType}</span>}
                  </div>
                  <div className="text-stone-500 text-xs">
                    {h.location.code} · {new Date(h.createdAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })} · {h.createdBy}
                    {h.note && <> · {h.note}</>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
