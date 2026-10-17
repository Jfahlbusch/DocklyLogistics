"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MD_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-field";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";

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
  const isDesktop = useMediaQuery(MD_QUERY, true);

  function setCounted(i: number, value: string) {
    setRows((prev) => prev.map((x, j) => (j === i ? { ...x, counted: value } : x)));
  }

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
    <ResponsiveDialog open onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent size="lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="font-display text-xl text-foreground">Inventur</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Lagerplatz wählen, gezählte Mengen erfassen, buchen. Abweichungen werden als
            INVENTORY-Bewegung verbucht.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-3">
          <select
            aria-label="Lagerplatz"
            className={`${NATIVE_SELECT_CLASS} w-full`}
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
          ) : rows.length > 0 && !isDesktop ? (
            <ul data-testid="inventory-cards" className="divide-y divide-border rounded-lg border border-border">
              {rows.map((r, i) => (
                <li key={r.id} className="space-y-2 p-3">
                  <div>
                    <div className="break-words text-foreground">{r.article.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{r.article.sku}</div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-muted-foreground">
                      Soll <span className="font-mono tabular-nums text-foreground">{r.quantity}</span>
                    </div>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      aria-label={`Gezählt: ${r.article.name}`}
                      value={r.counted}
                      onChange={(e) => setCounted(i, e.target.value)}
                      className="h-11 w-28 text-right text-base"
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : rows.length > 0 ? (
            <div className="overflow-x-auto">
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
                          inputMode="numeric"
                          min={0}
                          aria-label={`Gezählt: ${r.article.name}`}
                          value={r.counted}
                          onChange={(e) => setCounted(i, e.target.value)}
                          className="h-8 w-24 text-right ml-auto"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {error && <div role="alert" className="text-sm text-danger">{error}</div>}
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
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
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
