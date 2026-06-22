"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LocationOpt = { id: string; code: string; name: string };
type Balance = { id: string; articleId: string; quantity: number; article: { sku: string; name: string } };
type Row = Balance & { counted: string };

export function InventoryModal({
  locations,
  onClose,
  onPosted,
}: {
  locations: LocationOpt[];
  onClose: () => void;
  onPosted: (message: string) => void;
}) {
  const [locationId, setLocationId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadLocation(id: string) {
    setLocationId(id);
    setRows([]);
    setError(null);
    if (!id) return;
    setLoading(true);
    const r = await fetch(`/api/v1/stock?locationId=${id}&pageSize=500`);
    const b = await r.json().catch(() => ({}));
    setRows(((b.data ?? []) as Balance[]).map((x) => ({ ...x, counted: String(x.quantity) })));
    setLoading(false);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const counts = rows.map((r) => ({
      articleId: r.articleId,
      countedQty: Math.max(0, parseInt(r.counted || "0", 10) || 0),
    }));
    const r = await fetch("/api/v1/stock/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId, counts }),
    });
    const b = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      onPosted(`Inventur gebucht — ${b.data.adjusted} Korrektur(en).`);
      onClose();
    } else {
      setError(b.detail ?? b.title ?? "Buchung fehlgeschlagen");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-2xl shadow-soft max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className="p-5 space-y-3 overflow-auto">
          <h3 className="font-display text-xl text-foreground">Inventur</h3>
          <p className="text-sm text-muted-foreground">
            Lagerplatz wählen, gezählte Mengen erfassen, buchen. Abweichungen werden als
            INVENTORY-Bewegung verbucht.
          </p>

          <select
            className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground"
            value={locationId}
            onChange={(e) => loadLocation(e.target.value)}
          >
            <option value="">Lagerplatz wählen…</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} — {l.name}
              </option>
            ))}
          </select>

          {loading ? (
            <div className="py-6 text-center text-muted-foreground text-sm">Lädt…</div>
          ) : locationId && rows.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-sm">
              Keine Bestände an diesem Lagerplatz.
            </div>
          ) : rows.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  <th className="text-left font-medium px-3 py-2">Artikel</th>
                  <th className="text-right font-medium px-3 py-2">Soll</th>
                  <th className="text-right font-medium px-3 py-2">Gezählt</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="text-foreground">{r.article.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{r.article.sku}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{r.quantity}</td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        min={0}
                        value={r.counted}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, counted: e.target.value } : x)),
                          )
                        }
                        className="h-8 w-24 text-right ml-auto"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {error && <div className="text-sm text-danger">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button
              onClick={submit}
              disabled={busy || !locationId || rows.length === 0}
              className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900"
            >
              {busy ? "Buche…" : "Inventur buchen"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
