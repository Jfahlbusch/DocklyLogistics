"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SupplierDetailModal } from "./supplier-detail-modal";
import { SupplierForm, defaultSupplierValues } from "./supplier-form";

type SupplierCard = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  channel: "EMAIL" | "API" | "EDI";
  active: boolean;
  openOrders: number;
  ytdRevenue: string;
};

const CHANNEL_STYLES: Record<SupplierCard["channel"], string> = {
  EMAIL: "bg-stone-100 text-stone-700",
  API: "bg-navy-100 text-navy-900",
  EDI: "bg-gold-50 text-gold-700",
};

export function SuppliersView({
  cards,
  total,
  canCreate,
  canManage,
  q,
}: {
  cards: SupplierCard[];
  total: number;
  canCreate: boolean;
  canManage: boolean;
  q: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState(q);
  const [creating, setCreating] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(sp.toString());
    if (searchValue) params.set("q", searchValue);
    else params.delete("q");
    router.push(`/suppliers?${params.toString()}`);
  }

  function onChannelFilter(channel: string) {
    const params = new URLSearchParams(sp.toString());
    if (channel === "ALL") params.delete("channel");
    else params.set("channel", channel);
    router.push(`/suppliers?${params.toString()}`);
  }

  const currentChannel = sp.get("channel") ?? "ALL";

  return (
    <div className="space-y-4 max-w-app">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-navy-900">Lieferanten</h1>
          <p className="text-sm text-stone-500 mt-1">{total} aktive Lieferanten</p>
        </div>
        {canCreate && (
          <Button
            onClick={() => setCreating(true)}
            className="bg-navy-900 hover:bg-navy-700 text-white"
          >
            + Neuer Lieferant
          </Button>
        )}
      </div>

      {flash && (
        <div
          className={
            "text-sm px-3 py-2 rounded-lg border " +
            (flash.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700")
          }
        >
          {flash.text}
        </div>
      )}

      <Card className="shadow-soft">
        <form
          onSubmit={onSearch}
          className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-stone-200"
        >
          <Input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Suche nach Name, Kontakt, Email, Stadt…"
            className="flex-1 min-w-[240px]"
          />
          <div className="flex gap-1">
            {(["ALL", "EMAIL", "API", "EDI"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChannelFilter(c)}
                className={
                  "px-3 py-1.5 rounded-lg text-xs border transition-colors " +
                  (currentChannel === c
                    ? "bg-navy-900 text-white border-navy-900"
                    : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50")
                }
              >
                {c === "ALL" ? "Alle" : c}
              </button>
            ))}
          </div>
          <Button type="submit" variant="outline" className="text-sm">
            Suchen
          </Button>
        </form>
      </Card>

      {cards.length === 0 ? (
        <Card className="shadow-soft">
          <CardContent className="py-10 text-center text-stone-500">
            Keine Lieferanten gefunden.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {cards.map((s) => (
            <Card
              key={s.id}
              onClick={() => setSelected(s.id)}
              className="cursor-pointer shadow-soft hover:border-stone-300 transition-colors"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] tracking-[0.18em] uppercase text-stone-500 font-mono">
                      {s.id.slice(0, 8)}
                    </div>
                    <h3 className="font-display text-xl text-navy-900 mt-1">{s.name}</h3>
                    <div className="text-stone-500 text-sm mt-0.5 truncate">
                      {s.contactName} · {s.city}
                    </div>
                    <div className="text-stone-500 text-sm mt-0.5 truncate">{s.email}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${CHANNEL_STYLES[s.channel]}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                      {s.channel}
                    </span>
                    <div className="text-[11px] text-stone-500 mt-2">
                      {s.openOrders} offene Bestellungen
                    </div>
                  </div>
                </div>
                <div className="flex items-end justify-between mt-4 pt-3 border-t border-stone-100">
                  <div className="text-stone-500 text-sm">YTD Umsatz</div>
                  <div className="font-display text-lg text-navy-900">€ {s.ytdRevenue}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SupplierDetailModal
        supplierId={selected}
        canManage={canManage}
        onClose={() => setSelected(null)}
        onDeleted={(name) => {
          setSelected(null);
          setFlash({ ok: true, text: `Lieferant "${name}" gelöscht` });
          startTransition(() => router.refresh());
        }}
        onUpdated={(name) => {
          setFlash({ ok: true, text: `Lieferant "${name}" aktualisiert` });
          startTransition(() => router.refresh());
        }}
      />

      <Dialog
        open={creating}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setCreateError(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-navy-900">
              Neuer Lieferant
            </DialogTitle>
            <DialogDescription>Pflichtfelder sind mit * markiert.</DialogDescription>
          </DialogHeader>
          <SupplierForm
            initial={defaultSupplierValues}
            isCreate
            busy={createBusy}
            errorMessage={createError}
            onCancel={() => {
              setCreating(false);
              setCreateError(null);
            }}
            onSubmit={async (values) => {
              setCreateBusy(true);
              setCreateError(null);
              try {
                const r = await fetch("/api/v1/suppliers", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(values),
                });
                const body = await r.json();
                if (r.ok) {
                  setFlash({ ok: true, text: `Lieferant "${values.name}" angelegt` });
                  setCreating(false);
                  startTransition(() => router.refresh());
                } else {
                  setCreateError(body.detail ?? body.title ?? "Fehler beim Anlegen");
                }
              } finally {
                setCreateBusy(false);
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
