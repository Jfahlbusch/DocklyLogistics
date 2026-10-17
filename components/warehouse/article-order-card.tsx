"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { suggestedOrderQty } from "@/lib/domain/article-quantities";
import { QuantityStepper } from "@/components/warehouse/quantity-stepper";

export type OrderCardArticle = {
  id: string;
  sku: string;
  name: string;
  category?: string | null;
  baseUnit: string;
  orderUnit: string;
  packFactor: number;
  minStock: number;
  targetStock?: number | null;
  maxStock?: number | null;
};

export type OrderCardSaved = { qtyOrderUnit: number; capacityWarning: boolean };

type Props = {
  article: OrderCardArticle;
  /** Gesamtbestand in Basiseinheiten. */
  stockTotal: number;
  /** Wird nach erfolgreichem Speichern (200/201) aufgerufen, z. B. um die Liste offener Vorschläge neu zu laden. */
  onSaved?: (saved: OrderCardSaved) => void;
  /** Zusatzinhalt zwischen Stepper und Übernehmen-Knopf (z. B. Bestand pro Lagerplatz). */
  children?: ReactNode;
  disabled?: boolean;
};

type Message = { ok: boolean; text: string };

const dash = "—";

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border p-2">
      <div className="truncate text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl text-foreground">{value}</div>
    </div>
  );
}

/**
 * Artikelkarte für Lagermodus und Zonen-Rundgang: Kennzahlen, Mengen-Stepper (vorbelegt mit der Differenz
 * zur empfohlenen Menge bzw. dem offenen Vorschlag) und Übernahme in die Bestellvorschläge.
 * Reine Props/Callbacks – kennt weder Scanner noch Seitenzustand.
 */
export function ArticleOrderCard({ article, stockTotal, onSaved, children, disabled = false }: Props) {
  const t = useTranslations("warehouse.card");
  const suggested = suggestedOrderQty(article, stockTotal);
  const [qty, setQty] = useState(suggested);
  const [pending, setPending] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const touched = useRef(false);

  function change(n: number) {
    touched.current = true;
    setQty(n);
  }

  // Vorbelegung folgt Bestand/Artikel, solange der Nutzer nichts geändert hat und kein offener Vorschlag existiert.
  useEffect(() => {
    if (!touched.current && pending == null) setQty(suggested);
  }, [suggested, pending]);

  // Offenen Vorschlag des Artikels laden.
  useEffect(() => {
    let cancelled = false;
    setPending(null);
    (async () => {
      try {
        const r = await fetch(
          `/api/v1/order-suggestions?status=PENDING&articleId=${encodeURIComponent(article.id)}&pageSize=1`,
        );
        if (!r.ok) return;
        const body = await r.json();
        const open = (body.data ?? [])[0] as { qtyOrderUnit: number } | undefined;
        if (cancelled || !open) return;
        setPending(open.qtyOrderUnit);
        if (!touched.current) setQty(open.qtyOrderUnit);
      } catch {
        /* ohne offenen Vorschlag weiterarbeiten */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [article.id]);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await fetch(`/api/v1/articles/${encodeURIComponent(article.id)}/pending-suggestion`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qtyOrderUnit: qty }),
      });
      if (r.status === 204) {
        setMessage({ ok: true, text: t("nothingToOrder") });
        return;
      }
      if (!r.ok) {
        setMessage({ ok: false, text: t("saveFailed") });
        return;
      }
      const body = (await r.json()) as { data?: { status?: string }; capacityWarning?: boolean };
      const dismissed = body.data?.status === "DISMISSED";
      const warning = !dismissed && body.capacityWarning === true;
      setPending(dismissed ? null : qty);
      setMessage({
        ok: true,
        text: dismissed
          ? t("dismissed")
          : t("saved", { qty, unit: article.orderUnit }) + (warning ? ` ${t("capacityHint")}` : ""),
      });
      onSaved?.({ qtyOrderUnit: qty, capacityWarning: warning });
    } catch {
      setMessage({ ok: false, text: t("saveFailed") });
    } finally {
      setBusy(false);
    }
  }

  const show = (n: number | null | undefined) => (n == null ? dash : String(n));

  return (
    <div className="space-y-4">
      <div className="min-w-0">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{article.sku}</div>
        <h2 className="mt-1 break-words font-display text-xl text-foreground">{article.name}</h2>
        <div className="mt-1 text-xs text-muted-foreground">
          {article.category ?? dash} · {article.orderUnit} ({article.packFactor} × {article.baseUnit})
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4">
        <Kpi label={t("stock")} value={String(stockTotal)} />
        <Kpi label={t("min")} value={show(article.minStock)} />
        <Kpi label={t("target")} value={show(article.targetStock)} />
        <Kpi label={t("max")} value={show(article.maxStock)} />
      </div>

      <div className="space-y-2">
        {pending != null && (
          <p className="text-center text-sm font-medium text-foreground">{t("pending", { qty: pending })}</p>
        )}
        <QuantityStepper
          value={qty}
          onChange={change}
          orderUnitLabel={article.orderUnit}
          baseUnitLabel={article.baseUnit}
          packFactor={article.packFactor}
          stockTotal={stockTotal}
          maxStock={article.maxStock ?? null}
          disabled={disabled || busy}
        />
      </div>

      {children}

      {message && (
        <p
          role="status"
          className={
            "rounded-lg border px-3 py-2 text-sm " +
            (message.ok
              ? "border-success/40 bg-success/10 text-foreground"
              : "border-destructive/40 bg-destructive/10 text-destructive")
          }
        >
          {message.text}
        </p>
      )}

      <Button
        type="button"
        onClick={save}
        disabled={disabled || busy}
        className="h-14 w-full bg-gold-500 text-base font-medium text-foreground hover:bg-gold-400"
      >
        {busy ? t("saving") : t("submit")}
      </Button>
    </div>
  );
}
