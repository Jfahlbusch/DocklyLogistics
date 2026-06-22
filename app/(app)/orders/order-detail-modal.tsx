"use client";

import { FlashBanner } from "@/components/ui/flash-banner";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReceiveModal } from "./receive-modal";
import { StatusPill } from "@/components/ui/status-pill";

type Article = { sku: string; name: string; orderUnit: string; baseUnit: string; packFactor: number; defaultLocationId: string | null };
type OrderItem = {
  id: string;
  qtyOrderUnit: number;
  qtyBase: number;
  qtyReceived: number;
  unitPrice: string;
  lineTotal: string;
  article: Article;
};
type Event = {
  id: string;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorEmail: string;
  payload: Record<string, unknown>;
  createdAt: string;
};
type Order = {
  id: string;
  orderNo: string;
  status: string;
  currency: string;
  total: string;
  notes: string | null;
  createdAt: string;
  sentAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  pdfHash: string | null;
  supplier: { id: string; name: string; channel: "EMAIL" | "API" | "EDI"; email: string | null; city: string | null };
  items: OrderItem[];
  events: Event[];
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-muted text-foreground",
  REVIEW: "bg-gold-50 text-gold-700",
  APPROVED: "bg-gold-50 text-gold-700",
  SENT: "bg-navy-100 text-navy-700",
  CONFIRMED: "bg-emerald-50 text-emerald-700",
  PARTIALLY_RECEIVED: "bg-emerald-50 text-emerald-700",
  RECEIVED: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-rose-50 text-rose-700",
};

export function OrderDetailModal({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const router = useRouter();
  const open = orderId !== null;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) { setOrder(null); return; }
    setLoading(true);
    const r = await fetch(`/api/v1/orders/${orderId}`);
    const body = await r.json();
    setOrder(body?.data ?? null);
    setLoading(false);
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  async function transition(path: string, opts?: { body?: unknown; successText: string }) {
    if (!orderId) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await fetch(`/api/v1/orders/${orderId}/${path}`, {
        method: "POST",
        headers: opts?.body ? { "Content-Type": "application/json" } : {},
        body: opts?.body ? JSON.stringify(opts.body) : undefined,
      });
      const body = await r.json();
      if (r.ok) {
        setMessage({ ok: true, text: opts?.successText ?? "OK" });
        await load();
        router.refresh();
      } else {
        setMessage({ ok: false, text: body.detail ?? body.title ?? "Fehler" });
      }
    } finally {
      setBusy(false);
    }
  }

  const can = {
    approve: order?.status === "REVIEW",
    send:    order?.status === "APPROVED",
    cancel:  order && !["CANCELLED", "RECEIVED", "CLOSED"].includes(order.status),
    receive: order && ["SENT", "CONFIRMED", "PARTIALLY_RECEIVED"].includes(order.status),
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-4xl sm:max-w-4xl">
          {loading || !order ? (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>Bestellungs-Detail wird geladen</DialogTitle>
              </DialogHeader>
              <div className="py-10 text-center text-muted-foreground">Lade…</div>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground font-mono">{order.orderNo}</div>
                    <DialogTitle className="font-display text-2xl text-foreground">{order.supplier.name}</DialogTitle>
                    <DialogDescription className="text-muted-foreground">{order.supplier.city ?? "—"} · {order.supplier.email ?? "—"}</DialogDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusPill style={STATUS_STYLES[order.status]}>{order.status}</StatusPill>
                    <Badge variant="outline" className="text-xs">{order.supplier.channel}</Badge>
                  </div>
                </div>
              </DialogHeader>

              <FlashBanner flash={message} />

              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                <Kpi label="Positionen" value={String(order.items.length)} />
                <Kpi label="Summe" value={`€ ${Number(order.total).toFixed(2)}`} />
                <Kpi label="Erstellt" value={new Date(order.createdAt).toLocaleDateString("de-DE")} />
                <Kpi label="Versendet" value={order.sentAt ? new Date(order.sentAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "—"} />
              </div>

              {/* Items table */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/40 px-4 py-2 text-[11px] tracking-[0.16em] uppercase text-muted-foreground grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3">
                  <div>Artikel</div><div>Menge</div><div>Erhalten</div><div className="text-right">EK</div><div className="text-right">Summe</div>
                </div>
                {order.items.map((it) => (
                  <div key={it.id} className="px-4 py-3 grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 border-t border-border items-center">
                    <div>
                      <div className="font-medium text-foreground">{it.article.name}</div>
                      <div className="text-muted-foreground font-mono text-xs">{it.article.sku}</div>
                    </div>
                    <div className="text-sm">{it.qtyOrderUnit} × {it.article.orderUnit} <span className="text-muted-foreground text-xs">({it.qtyBase} {it.article.baseUnit})</span></div>
                    <div className={"text-sm " + (it.qtyReceived >= it.qtyBase ? "text-emerald-700" : it.qtyReceived > 0 ? "text-gold-700" : "text-muted-foreground")}>
                      {it.qtyReceived} / {it.qtyBase} {it.article.baseUnit}
                    </div>
                    <div className="text-right text-sm">{Number(it.unitPrice).toFixed(2)} {order.currency}</div>
                    <div className="text-right font-medium">{Number(it.lineTotal).toFixed(2)} {order.currency}</div>
                  </div>
                ))}
                <div className="px-4 py-3 bg-muted/40 grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 font-display text-foreground text-sm">
                  <div className="col-span-4 text-right">Gesamt</div>
                  <div className="text-right">{Number(order.total).toFixed(2)} {order.currency}</div>
                </div>
              </div>

              {order.notes && (
                <div className="border border-border rounded-xl p-3 bg-muted/40">
                  <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-1">Notiz</div>
                  <div className="text-sm">{order.notes}</div>
                </div>
              )}

              {/* Event-Timeline */}
              <div className="border border-border rounded-xl">
                <div className="bg-muted/40 px-4 py-2 text-[11px] tracking-[0.16em] uppercase text-muted-foreground">Ereignis-Timeline</div>
                <ol className="p-4 space-y-3">
                  {order.events.map((e) => (
                    <li key={e.id} className="flex gap-3">
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-gold-500 flex-none" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap text-sm">
                          <span className="font-medium text-foreground">{e.type}</span>
                          {e.fromStatus && e.toStatus && (
                            <span className="text-muted-foreground text-xs">{e.fromStatus} → {e.toStatus}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {new Date(e.createdAt).toLocaleString("de-DE")} · {e.actorEmail}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Actions */}
              <div className="flex justify-between gap-2 pt-2 flex-wrap">
                <div className="flex gap-2 flex-wrap">
                  <a href={`/api/v1/orders/${order.id}/pdf`} target="_blank" rel="noreferrer">
                    <Button variant="outline" className="text-sm">PDF</Button>
                  </a>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {can.cancel && (
                    <Button variant="outline" onClick={() => transition("cancel", { successText: "Storniert" })} disabled={busy} className="text-sm text-rose-600 border-rose-200 hover:bg-rose-50">
                      Stornieren
                    </Button>
                  )}
                  {can.approve && (
                    <Button onClick={() => transition("approve", { successText: "Freigegeben (APPROVED)" })} disabled={busy} className="bg-gold-500 hover:bg-gold-400 text-foreground text-sm font-medium">
                      Freigeben
                    </Button>
                  )}
                  {can.send && (
                    <Button onClick={() => transition("send", { successText: "Versendet — Status SENT" })} disabled={busy} className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900 text-sm">
                      Senden
                    </Button>
                  )}
                  {can.receive && (
                    <Button onClick={() => setReceiveOpen(true)} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm">
                      Wareneingang
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {order && receiveOpen && (
        <ReceiveModal
          order={order}
          onClose={() => setReceiveOpen(false)}
          onDone={() => { setReceiveOpen(false); load(); router.refresh(); }}
        />
      )}
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-xl px-3 py-2">
      <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground mt-0.5">{value}</div>
    </div>
  );
}
