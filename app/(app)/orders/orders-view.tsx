"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrderDetailModal } from "./order-detail-modal";
import { useOpenParam } from "@/lib/search/use-open-param";

type Row = {
  id: string;
  orderNo: string;
  supplierName: string;
  channel: "EMAIL" | "API" | "EDI";
  status: string;
  itemCount: number;
  total: string;
  currency: string;
  createdAt: string;
  sentAt: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT:              "bg-stone-100 text-stone-700",
  REVIEW:             "bg-gold-50 text-gold-700",
  APPROVED:           "bg-gold-50 text-gold-700",
  SENT:               "bg-navy-100 text-navy-700",
  CONFIRMED:          "bg-emerald-50 text-emerald-700",
  PARTIALLY_RECEIVED: "bg-emerald-50 text-emerald-700",
  RECEIVED:           "bg-emerald-50 text-emerald-700",
  CLOSED:             "bg-stone-100 text-stone-500",
  CANCELLED:          "bg-rose-50 text-rose-700",
};

const CHANNEL_STYLES: Record<string, string> = {
  EMAIL: "bg-stone-100 text-stone-700",
  API:   "bg-navy-100 text-navy-700",
  EDI:   "bg-gold-50 text-gold-700",
};

export function OrdersView({
  rows, total, suppliers, canCreate, filters,
}: {
  rows: Row[]; total: number;
  suppliers: Array<{ id: string; name: string }>;
  canCreate: boolean;
  filters: { status: string; supplierId: string; q: string };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [selected, setSelected] = useState<string | null>(null);
  const closeDetail = useOpenParam(setSelected);
  const [searchValue, setSearchValue] = useState(filters.q);

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(sp.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    router.push(`/orders?${p.toString()}`);
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setParam("q", searchValue);
  }

  return (
    <div className="space-y-4 max-w-app">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-navy-900">Bestellungen</h1>
          <p className="text-sm text-stone-500 mt-1">{total} Bestellungen im Zeitraum</p>
        </div>
        {canCreate && (
          <Button className="bg-navy-900 hover:bg-navy-700 text-white" disabled title="Manuelle Anlage über die API (Scalar) oder über Bestellvorschläge → Bulk-Confirm">
            + Neue Bestellung
          </Button>
        )}
      </div>

      <Card className="shadow-soft">
        <form onSubmit={onSearch} className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-stone-200">
          <Input value={searchValue} onChange={(e) => setSearchValue(e.target.value)} placeholder="Suche nach Bestell-Nr. oder Lieferant…" className="flex-1 min-w-[240px]" />
          <select className="px-3 py-2 rounded-lg border border-stone-200 text-sm bg-white" value={filters.status} onChange={(e) => setParam("status", e.target.value)}>
            <option value="">Alle Status</option>
            {["DRAFT","REVIEW","APPROVED","SENT","CONFIRMED","PARTIALLY_RECEIVED","RECEIVED","CLOSED","CANCELLED"].map((s) =>
              <option key={s} value={s}>{s}</option>
            )}
          </select>
          <select className="px-3 py-2 rounded-lg border border-stone-200 text-sm bg-white" value={filters.supplierId} onChange={(e) => setParam("supplierId", e.target.value)}>
            <option value="">Alle Lieferanten</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Button type="submit" variant="outline" className="text-sm">Suchen</Button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 text-[11px] tracking-[0.16em] uppercase text-stone-500">
                <th className="text-left font-medium px-4 py-3">Nr.</th>
                <th className="text-left font-medium px-4 py-3">Lieferant</th>
                <th className="text-left font-medium px-4 py-3">Kanal</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
                <th className="text-left font-medium px-4 py-3">Pos.</th>
                <th className="text-left font-medium px-4 py-3">Summe</th>
                <th className="text-left font-medium px-4 py-3">Erstellt</th>
                <th className="text-left font-medium px-4 py-3">Versendet</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} className="text-center text-stone-500 py-10">Keine Bestellungen.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} onClick={() => setSelected(r.id)} className="border-t border-stone-100 hover:bg-stone-50 cursor-pointer">
                  <td className="px-4 py-3 font-mono text-xs">{r.orderNo}</td>
                  <td className="px-4 py-3 font-medium text-navy-900">{r.supplierName}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${CHANNEL_STYLES[r.channel] ?? "bg-stone-100 text-stone-700"}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />{r.channel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLES[r.status] ?? "bg-stone-100 text-stone-700"}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />{r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{r.itemCount}</td>
                  <td className="px-4 py-3 font-medium">€ {Number(r.total).toFixed(2)}</td>
                  <td className="px-4 py-3 text-xs text-stone-500">{new Date(r.createdAt).toLocaleDateString("de-DE")}</td>
                  <td className="px-4 py-3 text-xs text-stone-500">{r.sentAt ? new Date(r.sentAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <OrderDetailModal orderId={selected} onClose={closeDetail} />
    </div>
  );
}
