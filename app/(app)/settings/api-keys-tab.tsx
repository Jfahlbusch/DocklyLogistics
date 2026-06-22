"use client";

import { useEffect, useState } from "react";
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

type KeyRow = {
  id: string;
  label: string | null;
  prefix: string;
  role: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "—";
}

export function ApiKeysTab({ role }: { role: string }) {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/v1/me/api-keys");
    if (r.ok) {
      const b = await r.json();
      setKeys(b.data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setBusy(true);
    const r = await fetch("/api/v1/me/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: label.trim() || undefined,
        expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
      }),
    });
    const b = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      setNewKey(b.data.key);
      setCopied(false);
      setCreating(false);
      setLabel("");
      setExpiresInDays("");
      load();
    } else {
      setFlash({ ok: false, text: b.detail ?? b.title ?? "Anlegen fehlgeschlagen" });
    }
  }

  async function revoke(k: KeyRow) {
    if (!confirm(`API-Key ${k.prefix}… widerrufen? Anwendungen mit diesem Key verlieren sofort den Zugriff.`)) return;
    const r = await fetch(`/api/v1/me/api-keys/${k.id}`, { method: "DELETE" });
    if (r.status === 204) {
      setFlash({ ok: true, text: "API-Key widerrufen" });
      load();
    } else {
      setFlash({ ok: false, text: "Widerrufen fehlgeschlagen" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-3xl">
          Persönliche API-Keys für den Zugriff auf die API (Header{" "}
          <code className="font-mono">X-API-Key</code>). Ein Key hat genau die Rechte deiner
          Rolle <span className="font-medium text-foreground">{role}</span> und wirkt nur in
          deinem Tenant. Der Key-Wert wird <strong>nur einmal</strong> angezeigt.
        </p>
        <Button
          onClick={() => {
            setCreating(true);
            setFlash(null);
          }}
          className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900"
        >
          + Neuer API-Key
        </Button>
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

      {newKey && (
        <div className="rounded-lg border border-gold-400 bg-gold-50 p-4 space-y-2">
          <div className="text-sm font-medium text-navy-900">
            Neuer API-Key — jetzt kopieren, er wird nicht erneut angezeigt:
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded-md bg-card px-3 py-2 font-mono text-xs text-foreground border border-border">
              {newKey}
            </code>
            <Button
              variant="outline"
              className="text-xs"
              onClick={() => {
                navigator.clipboard?.writeText(newKey);
                setCopied(true);
              }}
            >
              {copied ? "Kopiert ✓" : "Kopieren"}
            </Button>
            <Button variant="ghost" className="text-xs" onClick={() => setNewKey(null)}>
              Schließen
            </Button>
          </div>
        </div>
      )}

      <Card className="shadow-soft">
        <CardContent className="p-0">
          {loading ? (
            <div className="px-5 py-8 text-center text-muted-foreground text-sm">Lädt…</div>
          ) : keys.length === 0 ? (
            <div className="px-5 py-8 text-center text-muted-foreground text-sm">
              Noch keine API-Keys.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-[11px] tracking-[0.16em] uppercase text-muted-foreground">
                  <th className="text-left font-medium px-4 py-3">Bezeichnung</th>
                  <th className="text-left font-medium px-4 py-3">Prefix</th>
                  <th className="text-left font-medium px-4 py-3">Rolle</th>
                  <th className="text-left font-medium px-4 py-3">Zuletzt genutzt</th>
                  <th className="text-left font-medium px-4 py-3">Läuft ab</th>
                  <th className="text-right font-medium px-4 py-3">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-t border-border">
                    <td className="px-4 py-3 text-foreground">{k.label || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{k.prefix}…</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-navy-100 px-2.5 py-0.5 text-[11px] font-medium text-navy-700">
                        {k.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmt(k.lastUsedAt)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmt(k.expiresAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" className="text-xs px-2 py-1 text-danger" onClick={() => revoke(k)}>
                        Widerrufen
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={creating}
        onOpenChange={(o) => {
          if (!o) setCreating(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-foreground">Neuer API-Key</DialogTitle>
            <DialogDescription>
              Der Key erhält deine aktuellen Rechte ({role}). Nach dem Anlegen wird er einmalig
              angezeigt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground">Bezeichnung (optional)</label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="z. B. Integration ERP"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">
                Gültigkeit in Tagen (optional)
              </label>
              <Input
                type="number"
                min={1}
                max={365}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                placeholder="ohne Ablauf"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreating(false)}>
                Abbrechen
              </Button>
              <Button
                onClick={create}
                disabled={busy}
                className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900"
              >
                {busy ? "Erstelle…" : "Erstellen"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
