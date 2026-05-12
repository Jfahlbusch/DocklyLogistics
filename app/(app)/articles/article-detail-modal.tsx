"use client";

import { useEffect, useState } from "react";
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
  onClose,
}: {
  articleId: string | null;
  onClose: () => void;
}) {
  const open = articleId !== null;
  const [article, setArticle] = useState<Article | null>(null);
  const [suppliers, setSuppliers] = useState<ArticleSupplierLink[]>([]);
  const [barcode, setBarcode] = useState<BarcodeResult | null>(null);
  const [barcodeFormat, setBarcodeFormat] = useState<"code128" | "ean13">("code128");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!articleId) {
      setArticle(null);
      setSuppliers([]);
      setBarcode(null);
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
          <div className="py-10 text-center text-stone-500">Lade…</div>
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
                  <div className="border border-stone-200 rounded-xl p-4 bg-white flex flex-col items-center gap-2">
                    <div className="text-xs text-stone-500 font-mono">{barcode.value}</div>
                    <div dangerouslySetInnerHTML={{ __html: barcode.svg }} />
                    <a
                      href={`data:image/png;base64,${barcode.pngBase64}`}
                      download={`${article.sku}-${barcode.format}.png`}
                      className="text-xs text-navy-900 underline"
                    >
                      PNG herunterladen
                    </a>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="stock">
                <div className="text-stone-500 text-sm">
                  Bestandsverwaltung kommt in Phase M3 (Lagermodus + Stock-Engine).
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
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
