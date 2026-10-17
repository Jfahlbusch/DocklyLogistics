"use client";

import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { DetailField as Field } from "@/components/ui/detail-field";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArticleForm, type ArticleFormValues } from "./article-form";
import {
  ArticleSupplierForm,
  type LinkFormValues,
  defaultLinkValues,
} from "./article-supplier-form";

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
  targetStock?: number | null;
  maxStock?: number | null;
  defaultLocationId: string | null;
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
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
  const tq = useTranslations("articles.quantities");
  const confirm = useConfirm();
  const tz = useTranslations("articles.zone");
  const open = articleId !== null;
  const [article, setArticle] = useState<Article | null>(null);
  const [suppliers, setSuppliers] = useState<ArticleSupplierLink[]>([]);
  const [barcode, setBarcode] = useState<BarcodeResult | null>(null);
  const [barcodeFormat, setBarcodeFormat] = useState<"code128" | "ean13">("code128");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string[]> | null>(null);
  const [linkDialog, setLinkDialog] = useState<
    null | { mode: "create" } | { mode: "edit"; link: ArticleSupplierLink }
  >(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const canEdit = role === "USER" || role === "MANAGER" || role === "GLOBAL_ADMIN";
  const canDelete = role === "MANAGER" || role === "GLOBAL_ADMIN";

  const refetchSuppliers = useCallback(async () => {
    if (!articleId) return;
    const r = await fetch(`/api/v1/articles/${articleId}/suppliers`);
    const body = await r.json();
    setSuppliers(body?.data ?? []);
  }, [articleId]);

  useEffect(() => {
    if (!articleId) {
      setArticle(null);
      setSuppliers([]);
      setBarcode(null);
      setEditing(false);
      setEditError(null);
      setEditFieldErrors(null);
      setLinkDialog(null);
      setLinkError(null);
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

  async function makePrimary(l: ArticleSupplierLink) {
    if (!articleId) return;
    setLinkError(null);
    const r = await fetch(`/api/v1/articles/${articleId}/suppliers/${l.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrimary: true }),
    });
    if (r.ok) {
      await refetchSuppliers();
      router.refresh();
    } else {
      const body = await r.json().catch(() => ({}));
      setLinkError(body.detail ?? body.title ?? "Fehler beim Setzen");
    }
  }

  async function deleteLink(l: ArticleSupplierLink) {
    if (!articleId) return;
    if (!(await confirm({ title: `Zuordnung zu "${l.supplier.name}" wirklich entfernen?`, confirmLabel: "Entfernen", destructive: true }))) return;
    const r = await fetch(`/api/v1/articles/${articleId}/suppliers/${l.id}`, { method: "DELETE" });
    if (r.status === 204) {
      await refetchSuppliers();
      router.refresh();
    } else {
      const body = await r.json().catch(() => ({}));
      setLinkError(body.detail ?? body.title ?? "Löschen fehlgeschlagen");
    }
  }

  async function submitLinkForm(values: LinkFormValues) {
    if (!articleId || !linkDialog) return;
    setLinkBusy(true);
    setLinkError(null);
    try {
      if (linkDialog.mode === "create") {
        const r = await fetch(`/api/v1/articles/${articleId}/suppliers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        const body = await r.json();
        if (r.ok) {
          setLinkDialog(null);
          await refetchSuppliers();
          router.refresh();
        } else {
          setLinkError(body.detail ?? body.title ?? "Fehler beim Zuordnen");
        }
      } else {
        const { supplierId: _sId, ...patch } = values;
        void _sId;
        const r = await fetch(`/api/v1/articles/${articleId}/suppliers/${linkDialog.link.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const body = await r.json();
        if (r.ok) {
          setLinkDialog(null);
          await refetchSuppliers();
          router.refresh();
        } else {
          setLinkError(body.detail ?? body.title ?? "Fehler beim Speichern");
        }
      }
    } finally {
      setLinkBusy(false);
    }
  }

  return (
    <>
    <ResponsiveDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent size="xl" className="sm:max-w-3xl">
        {loading || !article ? (
          <>
            <ResponsiveDialogHeader className="sr-only">
              <ResponsiveDialogTitle>Artikel-Detail wird geladen</ResponsiveDialogTitle>
            </ResponsiveDialogHeader>
            <ResponsiveDialogBody className="py-10 text-center text-muted-foreground">Lade…</ResponsiveDialogBody>
          </>
        ) : (
          <>
            <ResponsiveDialogHeader>
              <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground font-mono">
                {article.sku}
              </div>
              <ResponsiveDialogTitle className="font-display text-2xl text-foreground">
                {article.name}
              </ResponsiveDialogTitle>
              {article.shortDesc && <ResponsiveDialogDescription>{article.shortDesc}</ResponsiveDialogDescription>}
            </ResponsiveDialogHeader>

            {!editing && (
            <ResponsiveDialogBody>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <Kpi label="Kategorie" value={article.category ?? "—"} />
              <Kpi label="Basiseinheit" value={article.baseUnit} />
              <Kpi label="Bestelleinheit" value={article.orderUnit} />
              <Kpi label="Mindestbestand" value={String(article.minStock)} />
            </div>

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
                <div data-testid="detail-zone">
                  <Field label={tz("label")} value={article.zone?.name ?? tz("notSet")} />
                </div>
                <Field
                  label="Verpackungsfaktor"
                  value={`${article.packFactor} ${article.baseUnit} / ${article.orderUnit}`}
                />
                <QtyDetail testId="qty-minStock" label={tq("minStock")} value={article.minStock} unit={article.baseUnit} notSet={tq("notSet")} />
                <QtyDetail testId="qty-targetStock" label={tq("targetStock")} value={article.targetStock} unit={article.baseUnit} notSet={tq("notSet")} />
                <QtyDetail testId="qty-maxStock" label={tq("maxStock")} value={article.maxStock} unit={article.baseUnit} notSet={tq("notSet")} />
                {article.longDesc && <Field label="Beschreibung" value={article.longDesc} />}
              </TabsContent>

              <TabsContent value="suppliers" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                    Mehrere Lieferanten möglich · genau einer als <strong>primär</strong> markiert ·
                    Primärlieferant wird in Vorschlägen vorausgewählt.
                  </p>
                  {canEdit && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setLinkError(null);
                        setLinkDialog({ mode: "create" });
                      }}
                      className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900"
                    >
                      + Lieferant zuordnen
                    </Button>
                  )}
                </div>

                {linkError && !linkDialog && (
                  <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                    {linkError}
                  </div>
                )}

                {suppliers.length === 0 ? (
                  <div className="text-muted-foreground text-sm py-6 text-center border border-border rounded-lg">
                    Noch keine Lieferanten zugeordnet.
                  </div>
                ) : (
                  <>
                  <ul data-testid="supplier-link-cards" className="space-y-2 xl:hidden">
                    {suppliers.map((l) => (
                      <li key={l.id} className="space-y-2 rounded-xl border border-border p-3 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-foreground break-words">{l.supplier.name}</div>
                            {l.supplier.city && (
                              <div className="text-xs text-muted-foreground">{l.supplier.city}</div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary">{l.supplier.channel}</Badge>
                            {l.isPrimary && (
                              <Badge className="bg-gold-500 text-foreground hover:bg-gold-400">primär</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span>€ {Number(l.purchasePrice).toFixed(2)} {l.currency}</span>
                          <span>{l.leadTimeDays} Tage</span>
                          <span>Min {l.minOrderQty}</span>
                          {l.supplierSku && <span className="font-mono break-all">{l.supplierSku}</span>}
                        </div>
                        {canEdit && (
                          <div className="flex flex-wrap gap-2">
                            {!l.isPrimary && (
                              <Button type="button" variant="outline" onClick={() => makePrimary(l)}>
                                als primär
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setLinkError(null);
                                setLinkDialog({ mode: "edit", link: l });
                              }}
                            >
                              Bearbeiten
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="text-rose-700 border-rose-200 hover:bg-rose-50"
                              onClick={() => deleteLink(l)}
                            >
                              Löschen
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="hidden overflow-x-auto xl:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] tracking-[0.16em] uppercase text-muted-foreground bg-muted/40">
                        <th className="text-left p-2">Lieferant</th>
                        <th className="text-left p-2">Kanal</th>
                        <th className="text-right p-2">EK</th>
                        <th className="text-right p-2">Lieferzeit</th>
                        <th className="text-right p-2">Min</th>
                        <th className="text-left p-2">Lief.-SKU</th>
                        <th className="text-center p-2">Primär</th>
                        {canEdit && <th className="text-right p-2">Aktionen</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {suppliers.map((l) => (
                        <tr key={l.id} className="border-t border-border">
                          <td className="p-2">
                            <div className="font-medium text-foreground">{l.supplier.name}</div>
                            {l.supplier.city && (
                              <div className="text-xs text-muted-foreground">{l.supplier.city}</div>
                            )}
                          </td>
                          <td className="p-2">
                            <Badge variant="secondary">{l.supplier.channel}</Badge>
                          </td>
                          <td className="p-2 text-right">
                            € {Number(l.purchasePrice).toFixed(2)} {l.currency}
                          </td>
                          <td className="p-2 text-right">{l.leadTimeDays} Tage</td>
                          <td className="p-2 text-right">{l.minOrderQty}</td>
                          <td className="p-2 font-mono text-xs">{l.supplierSku ?? "—"}</td>
                          <td className="p-2 text-center">
                            {l.isPrimary ? (
                              <Badge className="bg-gold-500 text-foreground hover:bg-gold-400">
                                primär
                              </Badge>
                            ) : canEdit ? (
                              <button
                                onClick={() => makePrimary(l)}
                                className="text-xs text-foreground underline hover:text-navy-700"
                              >
                                als primär
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>
                          {canEdit && (
                            <td className="p-2 text-right whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setLinkError(null);
                                  setLinkDialog({ mode: "edit", link: l });
                                }}
                                className="text-xs text-foreground underline hover:text-navy-700 mr-3"
                              >
                                Bearbeiten
                              </button>
                              <button
                                onClick={() => deleteLink(l)}
                                className="text-xs text-rose-700 underline hover:text-rose-900"
                              >
                                Löschen
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="barcode" className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={barcodeFormat === "code128" ? "default" : "outline"}
                    onClick={() => generateBarcode("code128")}
                    className={
                      barcodeFormat === "code128"
                        ? "bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900"
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
                      barcodeFormat === "ean13" ? "bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900" : ""
                    }
                  >
                    EAN-13
                  </Button>
                </div>
                {!barcode && (
                  <div className="text-muted-foreground text-sm">
                    Format wählen, um Barcode zu generieren.
                  </div>
                )}
                {barcode && (
                  <div className="border border-border rounded-xl p-6 bg-card flex flex-col items-center gap-4">
                    <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
                      {barcode.format === "code128" ? "Code-128" : "EAN-13"}
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:image/png;base64,${barcode.pngBase64}`}
                      alt={`Barcode ${barcode.value}`}
                      className="max-w-full h-auto"
                      style={{ minHeight: "80px", imageRendering: "pixelated" }}
                    />
                    <div className="text-sm font-mono tracking-widest text-foreground">{barcode.value}</div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button asChild variant="outline">
                      <a
                        href={`data:image/png;base64,${barcode.pngBase64}`}
                        download={`${article.sku}-${barcode.format}.png`}
                      >
                        PNG herunterladen
                      </a>
                      </Button>
                      <Button asChild variant="outline">
                      <a
                        href={`data:image/svg+xml;utf8,${encodeURIComponent(barcode.svg)}`}
                        download={`${article.sku}-${barcode.format}.svg`}
                      >
                        SVG herunterladen
                      </a>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
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
                      >
                        Drucken
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="stock" className="space-y-3">
                <StockPanel articleId={article.id} minStock={article.minStock} baseUnit={article.baseUnit} />
              </TabsContent>
            </Tabs>
            </ResponsiveDialogBody>
            )}

            {editing && article && (
              <ArticleForm
                initial={articleToFormValues(article)}
                isCreate={false}
                busy={editBusy}
                errorMessage={editError}
                fieldErrors={editFieldErrors}
                onCancel={() => {
                  setEditing(false);
                  setEditError(null);
                  setEditFieldErrors(null);
                }}
                onSubmit={async (values) => {
                  setEditBusy(true);
                  setEditError(null);
                  setEditFieldErrors(null);
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
                      if (r.status === 422 && body.errors && typeof body.errors === "object") {
                        setEditFieldErrors(body.errors);
                      }
                      setEditError(body.detail ?? body.title ?? "Fehler beim Speichern");
                    }
                  } finally {
                    setEditBusy(false);
                  }
                }}
              />
            )}

            {!editing && article && (canEdit || canDelete) && (
              <ResponsiveDialogFooter>
                {canDelete && (
                  <Button
                    variant="outline"
                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                    onClick={async () => {
                      if (!(await confirm({ title: `Artikel "${article.name}" (${article.sku}) wirklich löschen?`, confirmLabel: "Löschen", destructive: true }))) return;
                      const r = await fetch(`/api/v1/articles/${article.id}`, { method: "DELETE" });
                      if (r.status === 204) {
                        onClose();
                        router.refresh();
                      } else {
                        const body = await r.json().catch(() => ({}));
                        toast.error(body.detail ?? body.title ?? "Löschen fehlgeschlagen");
                      }
                    }}
                  >
                    Löschen
                  </Button>
                )}
                {canEdit && (
                  <Button
                    onClick={() => setEditing(true)}
                    className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900"
                  >
                    Bearbeiten
                  </Button>
                )}
              </ResponsiveDialogFooter>
            )}
          </>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>

    {linkDialog && articleId && (
      <ResponsiveDialog
        open
        onOpenChange={(o) => {
          if (!o) {
            setLinkDialog(null);
            setLinkError(null);
          }
        }}
      >
        <ResponsiveDialogContent size="lg" className="sm:max-w-xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display text-xl text-foreground">
              {linkDialog.mode === "create" ? "Lieferant zuordnen" : "Zuordnung bearbeiten"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {linkDialog.mode === "create"
                ? "Wähle einen Lieferanten und gib Konditionen für diesen Artikel an."
                : `Konditionen für ${linkDialog.link.supplier.name} bearbeiten.`}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ArticleSupplierForm
            initial={
              linkDialog.mode === "create"
                ? defaultLinkValues
                : {
                    supplierId: linkDialog.link.supplier.id,
                    purchasePrice: Number(linkDialog.link.purchasePrice),
                    currency: linkDialog.link.currency,
                    isPrimary: linkDialog.link.isPrimary,
                    leadTimeDays: linkDialog.link.leadTimeDays,
                    minOrderQty: linkDialog.link.minOrderQty,
                    supplierSku: linkDialog.link.supplierSku ?? undefined,
                  }
            }
            isCreate={linkDialog.mode === "create"}
            excludeSupplierIds={suppliers.map((s) => s.supplier.id)}
            busy={linkBusy}
            errorMessage={linkError}
            onCancel={() => {
              setLinkDialog(null);
              setLinkError(null);
            }}
            onSubmit={submitLinkForm}
          />
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    )}
    </>
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
    targetStock: a.targetStock ?? null,
    maxStock: a.maxStock ?? null,
    defaultLocationId: a.defaultLocationId ?? undefined,
    zoneId: a.zoneId ?? null,
    vatRate: a.vatRate === null ? undefined : Number(a.vatRate),
  };
}

function QtyDetail({
  testId,
  label,
  value,
  unit,
  notSet,
}: {
  testId: string;
  label: string;
  value: number | null | undefined;
  unit: string;
  notSet: string;
}) {
  return (
    <div data-testid={testId}>
      <Field label={label} value={value == null ? notSet : `${value} ${unit}`} />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-xl px-4 py-3">
      <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground mt-1">{value}</div>
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

  if (loading) return <div className="py-6 text-center text-muted-foreground text-sm">Lade Bestand…</div>;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi label="Gesamtbestand" value={`${total} ${baseUnit}`} />
        <Kpi label="Mindestbestand" value={`${minStock} ${baseUnit}`} />
        <div className={"border rounded-xl px-4 py-3 " + (shortfall > 0 ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50")}>
          <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">Unterdeckung</div>
          <div className={"font-medium mt-1 " + (shortfall > 0 ? "text-rose-700" : "text-emerald-700")}>{shortfall} {baseUnit}</div>
        </div>
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <div className="bg-muted/40 px-4 py-2 text-[11px] tracking-[0.16em] uppercase text-muted-foreground">Bestand pro Lagerplatz</div>
        {balances.length === 0 ? (
          <div className="px-4 py-4 text-muted-foreground text-sm">Kein Bestand eingebucht.</div>
        ) : (
          <ul className="divide-y divide-border">
            {balances.map((b) => (
              <li key={b.id} className="px-4 py-2 flex items-center justify-between text-sm">
                <div>
                  <span className="font-mono text-xs">{b.location.code}</span>
                  <span className="text-muted-foreground ml-2">{b.location.name}</span>
                  {b.location.zone && <span className="text-muted-foreground text-xs ml-2">· {b.location.zone}</span>}
                </div>
                <div className="font-medium">{b.quantity} {baseUnit}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <div className="bg-muted/40 px-4 py-2 text-[11px] tracking-[0.16em] uppercase text-muted-foreground">Letzte Bewegungen</div>
        {history.length === 0 ? (
          <div className="px-4 py-4 text-muted-foreground text-sm">Keine Bewegungen.</div>
        ) : (
          <ul className="divide-y divide-border">
            {history.map((h) => (
              <li key={h.id} className="px-4 py-2 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={"font-medium " + (h.delta >= 0 ? "text-emerald-700" : "text-rose-700")}>
                      {h.delta >= 0 ? "+" : ""}{h.delta} {baseUnit}
                    </span>
                    <span className="text-muted-foreground text-xs">{h.reason}</span>
                    {h.refType && <span className="text-muted-foreground text-xs">· {h.refType}</span>}
                  </div>
                  <div className="text-muted-foreground text-xs">
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
