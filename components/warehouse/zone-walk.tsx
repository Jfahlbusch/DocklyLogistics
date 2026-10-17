"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArticleOrderCard,
  type OrderCardArticle,
  type OrderCardSaved,
} from "@/components/warehouse/article-order-card";

type WalkItem = {
  article: OrderCardArticle;
  location: { id: string; code: string; name: string } | null;
  stockTotal: number;
  suggestedQty: number;
  pendingSuggestion: { id: string; qtyOrderUnit: number } | null;
};

type WalkData = { zone: { id: string; name: string }; items: WalkItem[] };
type LoadState = { kind: "loading" } | { kind: "error"; notFound: boolean } | { kind: "ready"; data: WalkData };
type Outcome = "accepted" | "skipped";

const secondaryBtn = "h-11 min-w-[44px] flex-1 text-sm";

function clampIndex(i: number | undefined, n: number): number {
  return i != null && Number.isInteger(i) && i >= 0 && i < n ? i : 0;
}

/**
 * Zonen-Rundgang im Lagermodus: Artikel einer Zone nacheinander durchgehen (Lagerplatz als Orientierung),
 * Bestellmenge je Artikel über die gemeinsame `ArticleOrderCard`. Position steht in der URL (`i`), Zähler im Client.
 */
export function ZoneWalk({ zoneId, initialIndex }: { zoneId: string; initialIndex?: number }) {
  const t = useTranslations("warehouse.walk");
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [warnings, setWarnings] = useState<Record<string, boolean>>({});
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    (async () => {
      try {
        const r = await fetch(`/api/v1/zones/${encodeURIComponent(zoneId)}/walk`);
        if (cancelled) return;
        if (!r.ok) {
          setState({ kind: "error", notFound: r.status === 404 });
          return;
        }
        const body = (await r.json()) as { data: WalkData };
        if (cancelled) return;
        setIndex(clampIndex(initialIndex, body.data.items.length));
        setState({ kind: "ready", data: body.data });
      } catch {
        if (!cancelled) setState({ kind: "error", notFound: false });
      }
    })();
    return () => {
      cancelled = true;
    };
    // initialIndex gilt nur für das Laden; danach führt der lokale Zustand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoneId, reloadKey]);

  const goTo = useCallback(
    (i: number, total: number) => {
      setIndex(i);
      // Abschluss-Ansicht (i = total) steht nicht in der URL: Neuladen setzt beim letzten Artikel fort.
      if (i < total) router.replace(`/warehouse-mode?zone=${encodeURIComponent(zoneId)}&i=${i}`);
    },
    [router, zoneId],
  );

  if (state.kind === "loading") {
    return (
      <div data-testid="zone-walk" aria-busy="true" aria-label={t("loading")} className="space-y-4">
        <div className="h-8 w-2/3 animate-pulse rounded-lg bg-muted" />
        <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <Card className="shadow-soft" data-testid="zone-walk">
        <CardContent className="space-y-3 p-5">
          <p role="alert" className="text-sm text-foreground">
            {state.notFound ? t("notFound") : t("loadFailed")}
          </p>
          {state.notFound ? (
            <Button asChild variant="outline" className="h-11">
              <Link href="/warehouse-mode">{t("backToWarehouse")}</Link>
            </Button>
          ) : (
            <Button variant="outline" className="h-11" onClick={() => setReloadKey((k) => k + 1)}>
              {t("retry")}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const { zone, items } = state.data;
  const total = items.length;

  if (total === 0) {
    return (
      <Card className="shadow-soft" data-testid="zone-walk">
        <CardContent className="space-y-3 p-5">
          <p className="text-sm text-foreground">{t("empty")}</p>
          <Button asChild variant="outline" className="h-11">
            <Link href={`/stock?tab=zones&open=${encodeURIComponent(zone.id)}`}>{t("toZones")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (index >= total) {
    const accepted = Object.values(outcomes).filter((o) => o === "accepted").length;
    const skipped = Object.values(outcomes).filter((o) => o === "skipped").length;
    const warned = Object.entries(warnings).filter(([id, w]) => w && outcomes[id] === "accepted").length;
    const stat = (id: string, label: string, n: number) => (
      <div className="min-w-0 rounded-lg border border-border p-3 text-center">
        <div data-testid={id} className="font-display text-2xl text-foreground">
          {n}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </div>
    );
    return (
      <Card className="shadow-soft" data-testid="walk-summary">
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="font-display text-xl text-foreground">{t("doneTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("doneZone", { zone: zone.name })}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {stat("walk-count-accepted", t("accepted"), accepted)}
            {stat("walk-count-skipped", t("skipped"), skipped)}
            {stat("walk-count-warning", t("warnings"), warned)}
          </div>
          <div className="flex flex-col gap-2">
            <Button asChild className="h-14 w-full bg-gold-500 text-base font-medium text-foreground hover:bg-gold-400">
              <Link href="/order-suggestions">{t("toSuggestions")}</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              onClick={() => {
                setOutcomes({});
                setWarnings({});
                goTo(0, total);
              }}
            >
              {t("restart")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const item = items[index];
  const advance = () => goTo(index + 1, total);

  function onSaved(saved: OrderCardSaved) {
    setOutcomes((o) => ({ ...o, [item.article.id]: "accepted" }));
    setWarnings((w) => ({ ...w, [item.article.id]: saved.capacityWarning }));
    advance();
  }

  function onNothingToOrder() {
    setOutcomes((o) => ({ ...o, [item.article.id]: "accepted" }));
    setWarnings((w) => ({ ...w, [item.article.id]: false }));
    advance();
  }

  function skip() {
    setOutcomes((o) => (o[item.article.id] === "accepted" ? o : { ...o, [item.article.id]: "skipped" }));
    advance();
  }

  return (
    <div className="space-y-4" data-testid="zone-walk">
      <div className="space-y-2">
        <h2 className="font-display text-lg text-foreground">
          {t("header", { zone: zone.name, current: index + 1, total })}
        </h2>
        <div
          role="progressbar"
          aria-label={t("progress")}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={index + 1}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-gold-500" style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>
      </div>

      <div
        data-testid="walk-location"
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-soft"
      >
        <MapPin aria-hidden className="size-6 shrink-0 text-gold-700" />
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t("location")}</div>
          {item.location ? (
            <div className="break-words font-mono text-2xl font-semibold text-foreground">
              {item.location.code}
              <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">{item.location.name}</span>
            </div>
          ) : (
            <div className="text-base text-muted-foreground">{t("noLocation")}</div>
          )}
        </div>
      </div>

      {/* overflow-visible: sonst schaltet das overflow-hidden der Card das sticky des Hauptknopfs ab (ArticleOrderCard). */}
      <Card className="shadow-soft max-nav:overflow-visible" data-testid="walk-card">
        <CardContent className="p-4 sm:p-5">
          <ArticleOrderCard
            key={item.article.id}
            article={item.article}
            stockTotal={item.stockTotal}
            submitLabel={t("next")}
            onSaved={onSaved}
            onNothingToOrder={onNothingToOrder}
          />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        {index > 0 && (
          <Button type="button" variant="outline" className={secondaryBtn} onClick={() => goTo(index - 1, total)}>
            {t("back")}
          </Button>
        )}
        <Button type="button" variant="outline" className={secondaryBtn} onClick={skip}>
          {t("skip")}
        </Button>
      </div>
    </div>
  );
}
