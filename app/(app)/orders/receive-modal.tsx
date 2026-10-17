"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-field";

type Location = { id: string; code: string; name: string };
type OrderItemLite = {
  id: string;
  qtyBase: number;
  qtyReceived: number;
  article: { sku: string; name: string; baseUnit: string; defaultLocationId: string | null };
};
type OrderLite = {
  id: string;
  orderNo: string;
  items: OrderItemLite[];
};

export function ReceiveModal({
  order, onClose, onDone,
}: { order: OrderLite; onClose: () => void; onDone: () => void }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [lines, setLines] = useState<Record<string, { qty: number; locationId: string }>>(() => {
    const initial: Record<string, { qty: number; locationId: string }> = {};
    for (const it of order.items) {
      initial[it.id] = {
        qty: Math.max(0, it.qtyBase - it.qtyReceived),
        locationId: it.article.defaultLocationId ?? "",
      };
    }
    return initial;
  });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/locations?pageSize=200")
      .then((r) => r.json())
      .then((body) => setLocations((body.data ?? []).map((l: { id: string; code: string; name: string }) => ({ id: l.id, code: l.code, name: l.name }))));
  }, []);

  function setQty(itemId: string, qty: number) {
    setLines((cur) => ({ ...cur, [itemId]: { ...cur[itemId], qty: Math.max(0, qty) } }));
  }
  function setLoc(itemId: string, locationId: string) {
    setLines((cur) => ({ ...cur, [itemId]: { ...cur[itemId], locationId } }));
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    const items = Object.entries(lines)
      .filter(([, l]) => l.qty > 0)
      .map(([itemId, l]) => ({ itemId, qtyBase: l.qty, locationId: l.locationId || undefined }));
    if (items.length === 0) {
      setErr("Bitte mindestens eine Position mit einer Menge > 0 erfassen.");
      setBusy(false);
      return;
    }
    const r = await fetch(`/api/v1/orders/${order.id}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, note: note || undefined }),
    });
    const body = await r.json();
    setBusy(false);
    if (r.ok) onDone();
    else setErr(body.detail ?? body.title ?? "Fehler beim Buchen");
  }

  return (
    <ResponsiveDialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <ResponsiveDialogContent size="lg">
        <ResponsiveDialogHeader>
          <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground font-mono">{order.orderNo}</div>
          <ResponsiveDialogTitle className="font-display text-xl text-foreground">Wareneingang buchen</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-4">
          <div className="space-y-3">
            {order.items.map((it) => {
              const open = Math.max(0, it.qtyBase - it.qtyReceived);
              return (
                <div key={it.id} className="grid grid-cols-1 gap-3 items-center border-b border-border pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[2fr_1fr_1.5fr]">
                  <div>
                    <div className="font-medium text-foreground">{it.article.name}</div>
                    <div className="text-muted-foreground font-mono text-xs">{it.article.sku} · offen: {open} {it.article.baseUnit}</div>
                  </div>
                  <Input
                    type="number" inputMode="numeric" min={0} max={open}
                    value={lines[it.id]?.qty ?? 0}
                    onChange={(e) => setQty(it.id, Number(e.target.value))}
                    aria-label={`Menge ${it.article.name}`}
                  />
                  <select
                    value={lines[it.id]?.locationId ?? ""}
                    onChange={(e) => setLoc(it.id, e.target.value)}
                    aria-label={`Lagerplatz ${it.article.name}`}
                    className={NATIVE_SELECT_CLASS}
                  >
                    <option value="">{it.article.defaultLocationId ? "Standard-Lagerplatz" : "— Lagerplatz wählen —"}</option>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.code} · {l.name}</option>)}
                  </select>
                </div>
              );
            })}
          </div>

          <label className="block text-sm">
            <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-1">Notiz (optional)</div>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="z.B. Bruch / Verspätung" />
          </label>

          {err && <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{err}</div>}
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Abbrechen</Button>
          <Button onClick={submit} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 text-white">{busy ? "Buche…" : "Wareneingang buchen"}</Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
