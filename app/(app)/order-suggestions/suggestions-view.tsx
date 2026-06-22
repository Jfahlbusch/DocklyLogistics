"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Row = {
  id: string;
  status: string;
  reason: string;
  qtyOrderUnit: number;
  note: string | null;
  article: {
    sku: string;
    name: string;
    minStock: number;
    orderUnit: string;
    packFactor: number;
  };
  supplier: { id: string; name: string; channel: string } | null;
  createdAt: string;
};

type SupplierOption = { id: string; name: string; channel: string };

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-gold-50 text-gold-700",
  CONFIRMED: "bg-emerald-50 text-emerald-700",
  DISMISSED: "bg-muted text-muted-foreground",
};

const REASON_LABELS: Record<string, string> = {
  AUTO_MIN_STOCK: "Auto · Mindestbestand",
  MANUAL_SCAN: "Manuell · Lagermodus",
};

export function SuggestionsView({
  rows,
  total,
  currentStatus,
  suppliers,
  canConfirm,
}: {
  rows: Row[];
  total: number;
  currentStatus: string;
  suppliers: SupplierOption[];
  canConfirm: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draftEdits, setDraftEdits] = useState<
    Record<string, { qtyOrderUnit?: number; supplierId?: string | null }>
  >({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const pendingRows = useMemo(() => rows.filter((r) => r.status === "PENDING"), [rows]);

  function applyStatusFilter(next: string) {
    const p = new URLSearchParams(sp.toString());
    if (next === "ALL") p.delete("status");
    else p.set("status", next);
    router.push(`/order-suggestions?${p.toString()}`);
  }

  function toggleSelection(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === pendingRows.length) setSelected(new Set());
    else setSelected(new Set(pendingRows.map((r) => r.id)));
  }

  function editDraft(
    id: string,
    patch: { qtyOrderUnit?: number; supplierId?: string | null },
  ) {
    setDraftEdits((cur) => ({ ...cur, [id]: { ...cur[id], ...patch } }));
  }

  async function savePatch(id: string) {
    const patch = draftEdits[id];
    if (!patch) return;
    const r = await fetch(`/api/v1/order-suggestions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (r.ok) {
      setDraftEdits((cur) => {
        const c = { ...cur };
        delete c[id];
        return c;
      });
      setMessage({ ok: true, text: "Aktualisiert" });
      startTransition(() => router.refresh());
    } else {
      const body = await r.json().catch(() => ({}));
      setMessage({ ok: false, text: body.detail ?? body.title ?? "Speichern fehlgeschlagen" });
    }
  }

  async function regenerate() {
    const r = await fetch(`/api/v1/order-suggestions/regenerate`, { method: "POST" });
    const body = await r.json();
    if (r.ok) {
      setMessage({
        ok: true,
        text: `Neu berechnet: ${body.data.created} neu, ${body.data.skippedAlreadyPending} bereits vorhanden`,
      });
      startTransition(() => router.refresh());
    } else {
      setMessage({ ok: false, text: body.detail ?? "Fehler" });
    }
  }

  async function bulkConfirm() {
    if (selected.size === 0) return;
    const r = await fetch(`/api/v1/order-suggestions/bulk-confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    const body = await r.json();
    if (r.ok) {
      setMessage({
        ok: true,
        text: `${body.data.confirmed} bestätigt, ${body.data.skipped} übersprungen`,
      });
      setSelected(new Set());
      startTransition(() => router.refresh());
    } else {
      setMessage({ ok: false, text: body.detail ?? "Fehler" });
    }
  }

  async function dismissOne(id: string) {
    const r = await fetch(`/api/v1/order-suggestions/${id}/dismiss`, { method: "POST" });
    if (r.ok) {
      setMessage({ ok: true, text: "Verworfen" });
      startTransition(() => router.refresh());
    } else {
      const body = await r.json().catch(() => ({}));
      setMessage({ ok: false, text: body.detail ?? "Fehler" });
    }
  }

  return (
    <div className="space-y-4 max-w-app">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-foreground">Bestellvorschläge</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} Vorschläge · Bulk-Confirm gruppiert je Lieferant und erzeugt direkt Bestellungen im Status REVIEW.
          </p>
        </div>
        <div className="flex gap-2">
          {canConfirm && (
            <Button
              variant="outline"
              className="text-sm"
              onClick={regenerate}
              disabled={isPending}
            >
              Neu berechnen
            </Button>
          )}
          {canConfirm && (
            <Button
              onClick={bulkConfirm}
              disabled={selected.size === 0 || isPending}
              className="bg-gold-500 hover:bg-gold-400 text-foreground text-sm font-medium"
            >
              {selected.size} bestätigen
            </Button>
          )}
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

      <div className="flex gap-1">
        {(["ALL", "PENDING", "CONFIRMED", "DISMISSED"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => applyStatusFilter(s)}
            className={
              "px-3 py-1.5 rounded-lg text-xs border transition-colors " +
              (currentStatus === s ||
              (s === "ALL" && currentStatus === "PENDING" && !sp.get("status"))
                ? "bg-navy-900 text-white dark:bg-gold-500 dark:text-navy-900 border-navy-900"
                : "bg-card text-foreground border-border hover:bg-muted/40")
            }
          >
            {s === "ALL" ? "Alle" : s}
          </button>
        ))}
      </div>

      <Card className="shadow-soft">
        {rows.length === 0 ? (
          <CardContent className="py-10 text-center text-muted-foreground">
            Keine Vorschläge.
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-[11px] tracking-[0.16em] uppercase text-muted-foreground">
                  <th className="text-left font-medium px-4 py-3 w-12">
                    {canConfirm && currentStatus === "PENDING" && (
                      <input
                        type="checkbox"
                        checked={
                          pendingRows.length > 0 && selected.size === pendingRows.length
                        }
                        onChange={toggleAll}
                      />
                    )}
                  </th>
                  <th className="text-left font-medium px-4 py-3">Artikel</th>
                  <th className="text-left font-medium px-4 py-3">Grund</th>
                  <th className="text-left font-medium px-4 py-3">Lieferant</th>
                  <th className="text-left font-medium px-4 py-3">Menge (OrderUnit)</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-left font-medium px-4 py-3">Erstellt</th>
                  <th className="text-right font-medium px-4 py-3">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isRowPending = r.status === "PENDING";
                  const edit = draftEdits[r.id] ?? {};
                  const effectiveQty = edit.qtyOrderUnit ?? r.qtyOrderUnit;
                  const effectiveSupplierId =
                    edit.supplierId !== undefined ? edit.supplierId : r.supplier?.id ?? null;
                  const hasEdit = Object.keys(edit).length > 0;
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        {canConfirm && isRowPending && (
                          <input
                            type="checkbox"
                            checked={selected.has(r.id)}
                            onChange={() => toggleSelection(r.id)}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{r.article.name}</div>
                        <div className="text-muted-foreground font-mono text-xs">
                          {r.article.sku} · {r.article.orderUnit} ({r.article.packFactor} Stk)
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {REASON_LABELS[r.reason] ?? r.reason}
                      </td>
                      <td className="px-4 py-3">
                        {isRowPending && canConfirm ? (
                          <select
                            className="px-2 py-1 rounded-md border border-border text-sm bg-card"
                            value={effectiveSupplierId ?? ""}
                            onChange={(e) =>
                              editDraft(r.id, { supplierId: e.target.value || null })
                            }
                          >
                            <option value="">— kein Lieferant —</option>
                            {suppliers.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.channel})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div>{r.supplier?.name ?? "—"}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isRowPending && canConfirm ? (
                          <input
                            type="number"
                            min={1}
                            value={effectiveQty}
                            onChange={(e) =>
                              editDraft(r.id, {
                                qtyOrderUnit: Math.max(1, Number(e.target.value)),
                              })
                            }
                            className="w-20 px-2 py-1 rounded-md border border-border text-sm bg-card text-right"
                          />
                        ) : (
                          <div className="font-medium">{r.qtyOrderUnit}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium " +
                            (STATUS_STYLES[r.status] ?? "bg-muted text-foreground")
                          }
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString("de-DE", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {hasEdit && (
                          <button
                            type="button"
                            onClick={() => savePatch(r.id)}
                            className="text-xs px-2.5 py-1 rounded-md bg-navy-900 text-white dark:bg-gold-500 dark:text-navy-900 hover:bg-navy-700"
                          >
                            Speichern
                          </button>
                        )}
                        {isRowPending && canConfirm && (
                          <button
                            type="button"
                            onClick={() => dismissOne(r.id)}
                            className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted/40 text-foreground"
                          >
                            Verwerfen
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
