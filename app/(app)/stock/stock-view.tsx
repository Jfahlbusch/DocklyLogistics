"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  LocationForm,
  defaultLocationValues,
  type LocationFormValues,
} from "./location-form";

type Location = {
  id: string;
  code: string;
  name: string;
  zone: string;
  capacity: number | null;
  used: number;
};
type ArticleRow = {
  id: string;
  sku: string;
  name: string;
  locationCode: string;
  stock: number;
  minStock: number;
};

const ZONE_STYLES: Record<string, string> = {
  Trocken: "bg-stone-100 text-stone-700",
  Kühl: "bg-navy-100 text-navy-900",
};

export function StockView({
  locations,
  articles,
  totalUnits,
  role,
}: {
  locations: Location[];
  articles: ArticleRow[];
  totalUnits: number;
  role: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const canManage = role === "MANAGER" || role === "GLOBAL_ADMIN";

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInitial, setEditInitial] = useState<LocationFormValues | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!editingId) {
      setEditInitial(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/v1/locations/${editingId}`)
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        const l = body?.data;
        if (l) {
          setEditInitial({
            code: l.code,
            name: l.name,
            zone: l.zone ?? undefined,
            bin: l.bin ?? undefined,
            capacity: l.capacity ?? null,
            active: l.active,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [editingId]);

  async function handleDelete(l: Location) {
    if (!confirm(`Lagerplatz "${l.code}" wirklich löschen?`)) return;
    const r = await fetch(`/api/v1/locations/${l.id}`, { method: "DELETE" });
    if (r.status === 204) {
      setFlash({ ok: true, text: `Lagerplatz "${l.code}" gelöscht` });
      startTransition(() => router.refresh());
    } else {
      const body = await r.json().catch(() => ({}));
      setFlash({ ok: false, text: body.detail ?? body.title ?? "Löschen fehlgeschlagen" });
    }
  }

  const dialogOpen = creating || editingId !== null;
  const isCreate = creating;
  const initial = isCreate ? defaultLocationValues : editInitial;

  return (
    <div className="space-y-4 max-w-app">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-navy-900">Lager & Bestand</h1>
          <p className="text-sm text-stone-500 mt-1">
            {locations.length} Lagerplätze · {totalUnits} Einheiten eingelagert
          </p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <Button
              variant="outline"
              className="text-sm"
              onClick={() => {
                setCreating(true);
                setFormError(null);
              }}
            >
              + Lagerplatz
            </Button>
          )}
          <Button
            className="bg-navy-900 hover:bg-navy-700 text-white text-sm"
            disabled
            title="Inventur-Workflow kommt in M3"
          >
            Inventur starten
          </Button>
        </div>
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Lagerplätze */}
        <Card className="shadow-soft">
          <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
            <h2 className="font-display text-lg text-navy-900">Lagerplätze</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 text-[11px] tracking-[0.16em] uppercase text-stone-500">
                  <th className="text-left font-medium px-4 py-3">Code</th>
                  <th className="text-left font-medium px-4 py-3">Name</th>
                  <th className="text-left font-medium px-4 py-3">Zone</th>
                  <th className="text-left font-medium px-4 py-3">Belegung</th>
                  {canManage && (
                    <th className="text-right font-medium px-4 py-3">Aktionen</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {locations.length === 0 && (
                  <tr>
                    <td
                      colSpan={canManage ? 5 : 4}
                      className="text-center text-stone-500 py-8"
                    >
                      Keine Lagerplätze.
                    </td>
                  </tr>
                )}
                {locations.map((l) => {
                  const pct =
                    l.capacity && l.capacity > 0
                      ? Math.round((l.used / l.capacity) * 100)
                      : 0;
                  const barClass =
                    pct >= 95 ? "bg-rose-600" : pct >= 70 ? "bg-gold-500" : "bg-navy-900";
                  return (
                    <tr key={l.id} className="border-t border-stone-100">
                      <td className="px-4 py-3 font-mono text-xs">{l.code}</td>
                      <td className="px-4 py-3 text-stone-700">{l.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${ZONE_STYLES[l.zone] ?? "bg-stone-100 text-stone-700"}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                          {l.zone}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-[80px] h-2 bg-stone-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${barClass}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="text-stone-500 text-xs w-16 text-right tabular-nums">
                            {l.used}/{l.capacity ?? "—"}
                          </div>
                        </div>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setEditingId(l.id);
                              setFormError(null);
                            }}
                            className="text-xs text-navy-900 underline hover:text-navy-700 mr-3"
                          >
                            Bearbeiten
                          </button>
                          <button
                            onClick={() => handleDelete(l)}
                            className="text-xs text-rose-700 underline hover:text-rose-900"
                          >
                            Löschen
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Bestände je Artikel */}
        <Card className="shadow-soft">
          <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
            <h2 className="font-display text-lg text-navy-900">Bestände je Artikel</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 text-[11px] tracking-[0.16em] uppercase text-stone-500">
                  <th className="text-left font-medium px-4 py-3">Artikel</th>
                  <th className="text-left font-medium px-4 py-3">Platz</th>
                  <th className="text-left font-medium px-4 py-3">Bestand</th>
                  <th className="text-left font-medium px-4 py-3">Min</th>
                </tr>
              </thead>
              <tbody>
                {articles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-stone-500 py-8">
                      Keine Artikel.
                    </td>
                  </tr>
                )}
                {articles.map((a) => {
                  const belowMin = a.stock < a.minStock && a.minStock > 0;
                  return (
                    <tr key={a.id} className="border-t border-stone-100">
                      <td className="px-4 py-3">
                        <div className="font-medium text-navy-900">{a.name}</div>
                        <div className="text-stone-500 font-mono text-xs">{a.sku}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{a.locationCode}</td>
                      <td className="px-4 py-3">
                        <span className={belowMin ? "text-rose-600 font-medium" : ""}>
                          {a.stock}
                        </span>
                      </td>
                      <td className="px-4 py-3">{a.minStock}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setEditingId(null);
            setFormError(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-navy-900">
              {isCreate ? "Neuer Lagerplatz" : "Lagerplatz bearbeiten"}
            </DialogTitle>
            <DialogDescription>Pflichtfelder sind mit * markiert.</DialogDescription>
          </DialogHeader>
          {dialogOpen && initial && (
            <LocationForm
              initial={initial}
              isCreate={isCreate}
              busy={formBusy}
              errorMessage={formError}
              onCancel={() => {
                setCreating(false);
                setEditingId(null);
                setFormError(null);
              }}
              onSubmit={async (values) => {
                setFormBusy(true);
                setFormError(null);
                try {
                  const url = isCreate
                    ? "/api/v1/locations"
                    : `/api/v1/locations/${editingId}`;
                  const method = isCreate ? "POST" : "PATCH";
                  // PATCH should not include 'code' (immutable per UX)
                  const payload = isCreate
                    ? values
                    : (() => {
                        const { code: _c, ...rest } = values;
                        void _c;
                        return rest;
                      })();
                  const r = await fetch(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });
                  const body = await r.json();
                  if (r.ok) {
                    setFlash({
                      ok: true,
                      text: isCreate
                        ? `Lagerplatz "${values.code}" angelegt`
                        : `Lagerplatz "${values.code}" aktualisiert`,
                    });
                    setCreating(false);
                    setEditingId(null);
                    startTransition(() => router.refresh());
                  } else {
                    setFormError(body.detail ?? body.title ?? "Fehler beim Speichern");
                  }
                } finally {
                  setFormBusy(false);
                }
              }}
            />
          )}
          {dialogOpen && !initial && !isCreate && (
            <div className="py-10 text-center text-stone-500">Lade…</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
