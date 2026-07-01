"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { FlashBanner } from "@/components/ui/flash-banner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

type Row = {
  id: string;
  direction: "IN" | "OUT";
  type: string;
  status: string;
  transport: string | null;
  supplierName: string | null;
  documentNo: string | null;
  interchangeRef: string | null;
  error: string | null;
  createdAt: string;
};

type ParsedLine = {
  lineNo: number;
  ean: string | null;
  sku: string | null;
  name: string | null;
  qty: number | null;
  unit: string | null;
  price: number | null;
  articleId?: string | null;
  articleName?: string | null;
};

type Detail = Row & {
  payload: string;
  parsed: { lines?: ParsedLine[]; orderReference?: string; responseCode?: string; matchedLines?: number } | null;
  orderId: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  RECEIVED:    "bg-navy-100 text-navy-700",
  PROCESSED:   "bg-emerald-50 text-emerald-700",
  FAILED:      "bg-rose-50 text-rose-700",
  PENDING:     "bg-muted text-foreground",
  SENT:        "bg-emerald-50 text-emerald-700",
  SEND_FAILED: "bg-rose-50 text-rose-700",
};

const TYPE_LABELS: Record<string, string> = {
  ORDERS: "Bestellung",
  ORDRSP: "Bestellbestätigung",
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

function DirectionBadge({ direction }: { direction: "IN" | "OUT" }) {
  const Icon = direction === "IN" ? ArrowDownLeft : ArrowUpRight;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
      <Icon size={14} className={direction === "IN" ? "text-emerald-600" : "text-navy-700 dark:text-gold-500"} />
      {direction === "IN" ? "Eingang" : "Ausgang"}
    </span>
  );
}

export function EdiView({
  rows, total, page, pageSize, filters, canManage,
}: {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  filters: { direction: string; status: string };
  canManage: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(sp.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    p.delete("page");
    router.push(`/edi?${p.toString()}`);
  }

  function goPage(n: number) {
    const p = new URLSearchParams(sp.toString());
    p.set("page", String(n));
    router.push(`/edi?${p.toString()}`);
  }

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    let alive = true;
    fetch(`/api/v1/edi/messages/${selected}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((b) => { if (alive) setDetail(b.data as Detail); })
      .catch(() => { if (alive) setFlash({ ok: false, text: "Nachricht konnte nicht geladen werden" }); });
    return () => { alive = false; };
  }, [selected]);

  async function reprocess(id: string) {
    setBusy(true);
    try {
      const r = await fetch(`/api/v1/edi/messages/${id}/reprocess`, { method: "POST" });
      const b = await r.json().catch(() => ({}));
      if (r.ok) {
        const res = b.data as { status: string; error?: string };
        setFlash(res.status === "PROCESSED"
          ? { ok: true, text: "Nachricht erfolgreich verarbeitet" }
          : { ok: false, text: `Verarbeitung fehlgeschlagen: ${res.error ?? "unbekannt"}` });
        setSelected(null);
        startTransition(() => router.refresh());
      } else {
        setFlash({ ok: false, text: b.detail ?? b.title ?? "Erneute Verarbeitung fehlgeschlagen" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyPayload() {
    if (!detail) return;
    await navigator.clipboard.writeText(detail.payload);
    setFlash({ ok: true, text: "EDIFACT-Payload in die Zwischenablage kopiert" });
  }

  return (
    <div className="space-y-4 max-w-app">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-foreground">EDI</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} Nachrichten · Postfach & Identität unter Einstellungen → EDI
          </p>
        </div>
      </div>

      <FlashBanner flash={flash} />

      <Card className="shadow-soft">
        <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-border">
          <div className="flex gap-1">
            {([["", "Alle"], ["IN", "Eingang"], ["OUT", "Ausgang"]] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setParam("direction", v)}
                className={
                  "px-3 py-1.5 rounded-lg text-xs border transition-colors " +
                  (filters.direction === v
                    ? "bg-navy-900 text-white dark:bg-gold-500 dark:text-navy-900 border-navy-900"
                    : "bg-card text-foreground border-border hover:bg-muted/40")
                }
              >
                {label}
              </button>
            ))}
          </div>
          <select
            className="px-3 py-2 rounded-lg border border-border text-sm bg-card"
            value={filters.status}
            onChange={(e) => setParam("status", e.target.value)}
          >
            <option value="">Alle Status</option>
            {Object.keys(STATUS_STYLES).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {pages > 1 && (
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <Button variant="outline" className="px-2 py-1 text-xs" disabled={page <= 1} onClick={() => goPage(page - 1)}>
                Zurück
              </Button>
              Seite {page}/{pages}
              <Button variant="outline" className="px-2 py-1 text-xs" disabled={page >= pages} onClick={() => goPage(page + 1)}>
                Weiter
              </Button>
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[11px] tracking-[0.16em] uppercase text-muted-foreground">
                <th className="text-left font-medium px-4 py-3">Richtung</th>
                <th className="text-left font-medium px-4 py-3">Typ</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
                <th className="text-left font-medium px-4 py-3">Partner</th>
                <th className="text-left font-medium px-4 py-3">Dokument-Nr.</th>
                <th className="text-left font-medium px-4 py-3">Transport</th>
                <th className="text-left font-medium px-4 py-3">Zeit</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted-foreground py-10">
                    Noch keine EDI-Nachrichten. Eingehende Nachrichten landen automatisch hier;
                    ausgehende entstehen beim Senden einer Bestellung über den EDI-Kanal.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r.id)}
                  className="border-t border-border hover:bg-muted/40 cursor-pointer"
                >
                  <td className="px-4 py-3"><DirectionBadge direction={r.direction} /></td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{r.type}</div>
                    <div className="text-xs text-muted-foreground">{TYPE_LABELS[r.type] ?? ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill style={STATUS_STYLES[r.status] ?? "bg-muted text-foreground"}>{r.status}</StatusPill>
                  </td>
                  <td className="px-4 py-3">{r.supplierName ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.documentNo ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.transport ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: cards instead of a horizontally-scrolling table */}
        <div className="divide-y divide-border md:hidden">
          {rows.length === 0 && (
            <div className="px-4 py-10 text-center text-muted-foreground">Noch keine EDI-Nachrichten.</div>
          )}
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelected(r.id)}
              className="flex w-full flex-col gap-1.5 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/40"
            >
              <div className="flex items-center justify-between gap-2">
                <DirectionBadge direction={r.direction} />
                <StatusPill style={STATUS_STYLES[r.status] ?? "bg-muted text-foreground"}>{r.status}</StatusPill>
              </div>
              <div className="font-medium text-foreground">
                {r.type}
                {r.documentNo && <span className="ml-2 font-mono text-xs text-muted-foreground">{r.documentNo}</span>}
              </div>
              <div className="text-xs text-muted-foreground">
                {r.supplierName ? `${r.supplierName} · ` : ""}{fmtTime(r.createdAt)}
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Dialog open={selected !== null} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              EDI-Nachricht {detail ? `· ${detail.type}` : ""}
            </DialogTitle>
            <DialogDescription>
              {detail ? `${detail.direction === "IN" ? "Eingegangen" : "Versendet"} ${fmtTime(detail.createdAt)}` : "Lade…"}
            </DialogDescription>
          </DialogHeader>

          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-[11px] tracking-[0.16em] uppercase text-muted-foreground">Status</div>
                  <StatusPill style={STATUS_STYLES[detail.status] ?? "bg-muted text-foreground"}>{detail.status}</StatusPill>
                </div>
                <div>
                  <div className="text-[11px] tracking-[0.16em] uppercase text-muted-foreground">Dokument-Nr.</div>
                  <div className="font-mono text-xs">{detail.documentNo ?? "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] tracking-[0.16em] uppercase text-muted-foreground">Interchange</div>
                  <div className="font-mono text-xs">{detail.interchangeRef ?? "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] tracking-[0.16em] uppercase text-muted-foreground">Partner</div>
                  <div>{detail.supplierName ?? "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] tracking-[0.16em] uppercase text-muted-foreground">Transport</div>
                  <div>{detail.transport ?? "—"}</div>
                </div>
                {detail.parsed?.responseCode && (
                  <div>
                    <div className="text-[11px] tracking-[0.16em] uppercase text-muted-foreground">Antwortcode</div>
                    <div className="font-mono text-xs">{detail.parsed.responseCode}</div>
                  </div>
                )}
              </div>

              {detail.error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
                  {detail.error}
                </div>
              )}

              {detail.parsed?.lines && detail.parsed.lines.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] tracking-[0.16em] uppercase text-muted-foreground">
                    Positionen
                    {typeof detail.parsed.matchedLines === "number" &&
                      ` (${detail.parsed.matchedLines}/${detail.parsed.lines.length} Artikeln zugeordnet)`}
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/40 text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
                          <th className="px-3 py-2 text-left font-medium">#</th>
                          <th className="px-3 py-2 text-left font-medium">EAN / SKU</th>
                          <th className="px-3 py-2 text-left font-medium">Artikel</th>
                          <th className="px-3 py-2 text-right font-medium">Menge</th>
                          <th className="px-3 py-2 text-right font-medium">Preis</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.parsed.lines.map((l) => (
                          <tr key={l.lineNo} className="border-t border-border">
                            <td className="px-3 py-2">{l.lineNo}</td>
                            <td className="px-3 py-2 font-mono">{l.ean ?? l.sku ?? "—"}</td>
                            <td className="px-3 py-2">
                              {l.articleName ?? l.name ?? "—"}
                              {l.articleId
                                ? <span className="ml-1 text-emerald-600">✓</span>
                                : <span className="ml-1 text-muted-foreground">(kein Match)</span>}
                            </td>
                            <td className="px-3 py-2 text-right">{l.qty ?? "—"} {l.unit ?? ""}</td>
                            <td className="px-3 py-2 text-right">{l.price != null ? `€ ${l.price.toFixed(2)}` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div>
                <div className="mb-1 text-[11px] tracking-[0.16em] uppercase text-muted-foreground">EDIFACT-Payload</div>
                <pre className="max-h-56 overflow-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all">
                  {detail.payload}
                </pre>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" className="text-xs" onClick={copyPayload}>
                  Payload kopieren
                </Button>
                {canManage && detail.direction === "IN" && (
                  <Button
                    className="bg-navy-900 text-white hover:bg-navy-700 dark:bg-gold-500 dark:text-navy-900 dark:hover:bg-gold-400 text-xs"
                    disabled={busy}
                    onClick={() => reprocess(detail.id)}
                  >
                    {busy ? "Verarbeite…" : "Erneut verarbeiten"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
