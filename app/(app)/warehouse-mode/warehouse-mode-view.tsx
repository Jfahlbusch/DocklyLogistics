"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Camera, KeyRound, Upload } from "lucide-react";
import {
  addToOfflineQueue,
  getOfflineQueueSize,
  flushOfflineQueue,
} from "@/lib/offline-queue";

type Article = {
  id: string;
  sku: string;
  name: string;
  eanGtin: string | null;
  category: string | null;
  baseUnit: string;
  orderUnit: string;
  packFactor: number;
  minStock: number;
  defaultLocationId: string | null;
};

type Location = { id: string; code: string; name: string };

type Suggestion = {
  id: string;
  article: { sku: string; name: string };
  qtyOrderUnit: number;
  status: string;
  reason: string;
  supplier?: { name: string } | null;
};

type ResetReader = { reset?: () => void };

export function WarehouseModeView({
  role,
}: {
  role: string;
  tenant: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<ResetReader | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [article, setArticle] = useState<Article | null>(null);
  const [stock, setStock] = useState<{
    total: number;
    perLocation: Array<{
      locationId: string;
      locationCode: string;
      quantity: number;
    }>;
  } | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [offlineCount, setOfflineCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [adjustOpen, setAdjustOpen] = useState(false);

  const canAdjust =
    role === "USER" || role === "MANAGER" || role === "GLOBAL_ADMIN";

  const loadSuggestions = useCallback(async () => {
    const r = await fetch(
      `/api/v1/order-suggestions?status=PENDING&pageSize=10`,
    );
    if (r.ok) {
      const body = await r.json();
      setSuggestions((body.data ?? []) as Suggestion[]);
    }
  }, []);

  const loadLocations = useCallback(async () => {
    const r = await fetch(`/api/v1/locations?pageSize=200`);
    if (r.ok) {
      const body = await r.json();
      setLocations(
        ((body.data ?? []) as Array<{ id: string; code: string; name: string }>).map(
          (l) => ({ id: l.id, code: l.code, name: l.name }),
        ),
      );
    }
  }, []);

  useEffect(() => {
    loadSuggestions();
    loadLocations();
    setOfflineCount(getOfflineQueueSize());
  }, [loadSuggestions, loadLocations]);

  const stopScanner = useCallback(() => {
    const reader = readerRef.current;
    if (reader && typeof reader.reset === "function") reader.reset();
    readerRef.current = null;
    setScanning(false);
  }, []);

  const loadArticleDetail = useCallback(async (articleId: string) => {
    const [aRes, sRes] = await Promise.all([
      fetch(`/api/v1/articles/${articleId}`).then((r) => r.json()),
      fetch(`/api/v1/stock?articleId=${articleId}&pageSize=200`).then((r) =>
        r.json(),
      ),
    ]);
    const a = aRes?.data as Article | null;
    if (!a) {
      setMessage({
        ok: false,
        text: "Artikel-Detail konnte nicht geladen werden.",
      });
      return;
    }
    setArticle(a);

    const balances = (sRes?.data ?? []) as Array<{
      locationId: string;
      quantity: number;
      location: { code: string };
    }>;
    const total = balances.reduce((s, b) => s + b.quantity, 0);
    setStock({
      total,
      perLocation: balances.map((b) => ({
        locationId: b.locationId,
        locationCode: b.location.code,
        quantity: b.quantity,
      })),
    });
  }, []);

  const handleCodeDetected = useCallback(
    async (code: string) => {
      setBusy(true);
      setArticle(null);
      setStock(null);
      setMessage(null);
      try {
        const r = await fetch(
          `/api/v1/articles?q=${encodeURIComponent(code)}&pageSize=5`,
        );
        const body = await r.json();
        const items = (body.data ?? []) as Article[];
        const exact = items.find(
          (a) => a.sku === code || a.eanGtin === code,
        );
        if (exact) {
          await loadArticleDetail(exact.id);
        } else if (items.length > 0) {
          setMessage({
            ok: false,
            text: `Kein exakter Treffer für '${code}'. Erste Suchergebnisse: ${items
              .slice(0, 3)
              .map((a) => a.sku)
              .join(", ")}`,
          });
        } else {
          setMessage({
            ok: false,
            text: `Kein Artikel gefunden für Code '${code}'.`,
          });
        }
      } catch {
        addToOfflineQueue({ type: "SCAN", code, timestamp: Date.now() });
        const size = getOfflineQueueSize();
        setOfflineCount(size);
        setMessage({
          ok: false,
          text: `Offline — Scan '${code}' wurde in Queue gestellt (${size} insgesamt).`,
        });
      } finally {
        setBusy(false);
      }
    },
    [loadArticleDetail],
  );

  const startScanner = useCallback(async () => {
    setCameraError(null);
    try {
      const mod = await import("@zxing/browser");
      const reader = new mod.BrowserMultiFormatReader();
      readerRef.current = reader as unknown as ResetReader;
      if (!videoRef.current) throw new Error("Video element not ready");
      setScanning(true);
      await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (result) {
            const code = result.getText();
            stopScanner();
            handleCodeDetected(code);
          }
        },
      );
    } catch (e) {
      setCameraError((e as Error).message);
      setScanning(false);
    }
  }, [handleCodeDetected, stopScanner]);

  useEffect(() => () => stopScanner(), [stopScanner]);

  async function flushQueue() {
    if (offlineCount === 0) {
      setMessage({ ok: true, text: "Offline-Queue ist bereits leer." });
      return;
    }
    const flushed = await flushOfflineQueue((entry) => {
      if (entry.type !== "SCAN") return false;
      // Re-trigger lookup; we optimistically mark the entry as flushed.
      handleCodeDetected(entry.code).catch(() => {});
      return true;
    });
    setOfflineCount(getOfflineQueueSize());
    setMessage({
      ok: true,
      text: `${flushed} Einträge aus Queue verarbeitet.`,
    });
  }

  async function createSuggestionFromArticle() {
    if (!article) return;
    setBusy(true);
    try {
      const shortfall = Math.max(0, article.minStock - (stock?.total ?? 0));
      const qty = Math.max(
        1,
        Math.ceil(shortfall / Math.max(1, article.packFactor)),
      );
      const r = await fetch(`/api/v1/order-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: article.id,
          qtyOrderUnit: qty,
          reason: "MANUAL_SCAN",
          note: "Aus Lagermodus erstellt",
        }),
      });
      const body = await r.json();
      if (r.ok) {
        setMessage({
          ok: true,
          text: `Vorschlag erstellt: ${qty}x ${article.orderUnit}`,
        });
        await loadSuggestions();
      } else {
        setMessage({
          ok: false,
          text: body.detail ?? body.title ?? "Fehler",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  const shortfall =
    article && stock ? Math.max(0, article.minStock - stock.total) : 0;

  return (
    <div className="space-y-4 max-w-app">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-[0.18em] uppercase text-gold-700 font-medium">
            Lagermodus
          </div>
          <h1 className="font-display text-3xl text-foreground">Scanner</h1>
        </div>
        <div className="flex gap-2 items-center">
          {scanning && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Kamera aktiv
            </span>
          )}
          <Link href="/dashboard">
            <Button variant="outline" className="text-sm gap-2">
              <ArrowLeft size={14} /> Beenden
            </Button>
          </Link>
        </div>
      </div>

      {message && (
        <div
          className={
            "text-sm px-4 py-2 rounded-lg border " +
            (message.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700")
          }
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Scanner */}
        <div className="space-y-3">
          <div className="relative aspect-[4/3] bg-gradient-to-br from-navy-900 to-navy-700 rounded-xl overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            {!scanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="text-center text-white space-y-3">
                  <Camera size={48} className="mx-auto opacity-70" />
                  <Button
                    onClick={startScanner}
                    className="bg-gold-500 hover:bg-gold-400 text-foreground font-medium"
                  >
                    Kamera starten
                  </Button>
                  {cameraError && (
                    <div className="text-xs text-rose-200 max-w-xs mx-auto">
                      {cameraError}
                    </div>
                  )}
                </div>
              </div>
            )}
            {scanning && (
              <>
                <div
                  className="absolute inset-[18%] border-2 border-gold-500 rounded-lg"
                  style={{ boxShadow: "0 0 0 9999px rgba(15,42,68,.55)" }}
                />
                <div
                  className="absolute left-[18%] right-[18%] top-1/2 h-0.5 bg-gold-500"
                  style={{
                    boxShadow: "0 0 16px var(--color-gold-500, #C9A24B)",
                  }}
                />
                <div className="absolute left-0 right-0 bottom-3 text-center text-white text-sm">
                  Barcode ins Rechteck halten…
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="text-sm gap-2"
              onClick={scanning ? stopScanner : startScanner}
            >
              <Camera size={14} />{" "}
              {scanning ? "Scanner stoppen" : "Scanner starten"}
            </Button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualValue.trim()) {
                  handleCodeDetected(manualValue.trim());
                  setManualValue("");
                }
              }}
              className="flex gap-2 flex-1 min-w-[200px]"
            >
              <Input
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                placeholder="SKU / EAN manuell eingeben…"
                className="flex-1"
              />
              <Button type="submit" variant="outline" className="text-sm gap-2">
                <KeyRound size={14} /> Suche
              </Button>
            </form>
            <Button
              variant="outline"
              className="text-sm gap-2"
              onClick={flushQueue}
            >
              <Upload size={14} /> Offline-Queue ({offlineCount})
            </Button>
          </div>
        </div>

        {/* Detected article */}
        <Card className="shadow-soft">
          <CardContent className="p-5">
            {!article ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                Bitte einen Barcode scannen oder Code manuell eingeben.
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground font-mono">
                      {article.sku}
                    </div>
                    <h2 className="font-display text-xl text-foreground mt-1">
                      {article.name}
                    </h2>
                    <div className="text-xs text-muted-foreground mt-1">
                      {article.category ?? "—"} · {article.orderUnit} (
                      {article.packFactor} × {article.baseUnit})
                    </div>
                  </div>
                  {busy && (
                    <span className="text-xs text-muted-foreground">Lade…</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <Kpi
                    label="Aktueller Bestand"
                    value={String(stock?.total ?? 0)}
                    variant={shortfall > 0 ? "rose" : "default"}
                  />
                  <Kpi
                    label="Mindestbestand"
                    value={String(article.minStock)}
                  />
                  <Kpi
                    label="Unterdeckung"
                    value={String(shortfall)}
                    variant={shortfall > 0 ? "rose" : "default"}
                  />
                  <Kpi label="Bestelleinheit" value={article.orderUnit} />
                </div>

                {stock && stock.perLocation.length > 0 && (
                  <div className="mt-4 border border-border rounded-lg p-3">
                    <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
                      Bestand pro Lagerplatz
                    </div>
                    <ul className="space-y-1 text-sm">
                      {stock.perLocation.map((l) => (
                        <li
                          key={l.locationId}
                          className="flex justify-between"
                        >
                          <span className="font-mono text-xs">
                            {l.locationCode}
                          </span>
                          <span>
                            {l.quantity} {article.baseUnit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mt-5">
                  <Button
                    onClick={() => setAdjustOpen(true)}
                    disabled={!canAdjust}
                    className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900 text-sm"
                  >
                    Bestand korrigieren
                  </Button>
                  <Button
                    onClick={createSuggestionFromArticle}
                    disabled={!canAdjust || busy}
                    className="bg-gold-500 hover:bg-gold-400 text-foreground text-sm font-medium"
                  >
                    Bestellvorschlag
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Open suggestions footer */}
      <Card className="shadow-soft">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-lg text-foreground">
            Offene Bestellvorschläge ({suggestions.length})
          </h2>
          <Link href="/order-suggestions">
            <Button variant="outline" className="text-sm">
              Zur Übersicht
            </Button>
          </Link>
        </div>
        <CardContent className="p-0">
          {suggestions.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-sm">
              Keine offenen Vorschläge.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {suggestions.map((s) => (
                <li
                  key={s.id}
                  className="px-5 py-3 flex justify-between items-center text-sm"
                >
                  <div>
                    <div className="font-medium text-foreground">
                      {s.article.name}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {s.article.sku} ·{" "}
                      {s.reason === "AUTO_MIN_STOCK" ? "Auto" : "Manuell"} ·{" "}
                      {s.supplier?.name ?? "—"}
                    </div>
                  </div>
                  <div className="font-medium">{s.qtyOrderUnit} Stk</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {adjustOpen && article && (
        <AdjustModal
          article={article}
          locations={locations}
          defaultLocationId={article.defaultLocationId}
          onClose={() => setAdjustOpen(false)}
          onDone={() => {
            setAdjustOpen(false);
            loadArticleDetail(article.id);
          }}
        />
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant?: "default" | "rose";
}) {
  return (
    <div className="border border-border rounded-lg p-3">
      <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
        {label}
      </div>
      <div
        className={
          "font-display text-2xl mt-1 " +
          (variant === "rose" ? "text-rose-600" : "text-foreground")
        }
      >
        {value}
      </div>
    </div>
  );
}

function AdjustModal({
  article,
  locations,
  defaultLocationId,
  onClose,
  onDone,
}: {
  article: Article;
  locations: Location[];
  defaultLocationId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [locationId, setLocationId] = useState(
    defaultLocationId ?? locations[0]?.id ?? "",
  );
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState<
    "CORRECTION" | "RECEIPT" | "ISSUE" | "INVENTORY" | "MANUAL"
  >("CORRECTION");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!locationId || delta === 0) return;
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/v1/stock/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        articleId: article.id,
        locationId,
        delta,
        reason,
        note: note || undefined,
      }),
    });
    const body = await r.json();
    setBusy(false);
    if (r.ok) onDone();
    else setErr(body.detail ?? body.title ?? "Fehler");
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className="p-5 space-y-3">
          <h3 className="font-display text-lg text-foreground">
            Bestand korrigieren — {article.sku}
          </h3>
          <label className="block text-sm">
            <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-1">
              Lagerplatz
            </div>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-card text-sm"
            >
              <option value="">— bitte wählen —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} · {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-1">
              Delta (Basiseinheiten, positiv = Eingang, negativ = Korrektur/Abgang)
            </div>
            <Input
              type="number"
              value={delta}
              onChange={(e) => setDelta(Number(e.target.value))}
            />
          </label>
          <label className="block text-sm">
            <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-1">
              Grund
            </div>
            <select
              value={reason}
              onChange={(e) =>
                setReason(e.target.value as typeof reason)
              }
              className="w-full px-3 py-2 border border-border rounded-lg bg-card text-sm"
            >
              <option value="CORRECTION">Korrektur</option>
              <option value="RECEIPT">Wareneingang</option>
              <option value="ISSUE">Warenausgang</option>
              <option value="INVENTORY">Inventur</option>
              <option value="MANUAL">Manuell</option>
            </select>
          </label>
          <label className="block text-sm">
            <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-1">
              Notiz (optional)
            </div>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z.B. Bruch / Schwund"
            />
          </label>
          {err && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {err}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Abbrechen
            </Button>
            <Button
              onClick={submit}
              disabled={busy || !locationId || delta === 0}
              className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900"
            >
              {busy ? "Speichere…" : "Speichern"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
