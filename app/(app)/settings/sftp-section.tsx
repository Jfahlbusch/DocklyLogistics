"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlashBanner } from "@/components/ui/flash-banner";

type SftpView = {
  host: string; port: number; username: string; authType: "KEY" | "PASSWORD";
  hasPrivateKey: boolean; hasPassword: boolean; hostKeyFingerprint: string | null;
  outboxDir: string; inboxDir: string; inboxFormat: "XML" | "EDIFACT";
  routing: "FILE" | "SUBFOLDER"; active: boolean; autoSend: boolean;
  lastPolledAt: string | null; lastPollError: string | null;
};

type Form = {
  host: string; port: string; username: string; authType: "KEY" | "PASSWORD";
  secret: string; hostKeyFingerprint: string; outboxDir: string; inboxDir: string;
  inboxFormat: "XML" | "EDIFACT"; routing: "FILE" | "SUBFOLDER"; active: boolean; autoSend: boolean;
};

const EMPTY: Form = {
  host: "", port: "22", username: "", authType: "KEY", secret: "", hostKeyFingerprint: "",
  outboxDir: "/outbox", inboxDir: "/inbox", inboxFormat: "XML", routing: "FILE", active: true, autoSend: true,
};

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "nie";
}

/**
 * Einstellungen → EDI → SFTP-Brücke zur Warenwirtschaft. DocklyLogistics ist
 * Client eines separaten SFTP-Servers: Ausgangsordner wird gepollt und an die
 * Partner übertragen, Eingangsordner mit empfangenen Dokumenten befüllt.
 */
export function SftpSection({ canManage }: { canManage: boolean }) {
  const [view, setView] = useState<SftpView | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  function applyView(v: SftpView | null) {
    setView(v);
    if (v) {
      setForm({
        host: v.host, port: String(v.port), username: v.username, authType: v.authType,
        secret: "", hostKeyFingerprint: v.hostKeyFingerprint ?? "",
        outboxDir: v.outboxDir, inboxDir: v.inboxDir, inboxFormat: v.inboxFormat,
        routing: v.routing, active: v.active, autoSend: v.autoSend,
      });
    }
  }

  useEffect(() => {
    fetch("/api/v1/settings/edi/sftp")
      .then((r) => (r.ok ? r.json() : { data: null }))
      .then((b) => applyView((b.data ?? null) as SftpView | null))
      .finally(() => setLoaded(true));
  }, []);

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        host: form.host, port: Number(form.port) || 22, username: form.username, authType: form.authType,
        hostKeyFingerprint: form.hostKeyFingerprint.trim() || null,
        outboxDir: form.outboxDir, inboxDir: form.inboxDir, inboxFormat: form.inboxFormat,
        routing: form.routing, active: form.active, autoSend: form.autoSend,
      };
      if (form.secret.trim()) {
        if (form.authType === "KEY") payload.privateKey = form.secret;
        else payload.password = form.secret;
      }
      const r = await fetch("/api/v1/settings/edi/sftp", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const b = await r.json().catch(() => ({}));
      if (r.ok) { applyView(b.data as SftpView); setFlash({ ok: true, text: "SFTP-Einstellungen gespeichert" }); }
      else setFlash({ ok: false, text: b.detail ?? b.title ?? "Speichern fehlgeschlagen" });
    } finally { setBusy(false); }
  }

  async function act(path: string, okText: (d: { message?: string; sent?: number; processed?: number }) => string) {
    setBusy(true);
    try {
      const r = await fetch(`/api/v1/settings/edi/sftp/${path}`, { method: "POST" });
      const b = await r.json().catch(() => ({}));
      if (r.ok) {
        setFlash({ ok: true, text: okText(b.data ?? {}) });
        fetch("/api/v1/settings/edi/sftp").then((x) => x.json()).then((x) => applyView(x.data ?? null));
      } else setFlash({ ok: false, text: b.detail ?? b.title ?? "Aktion fehlgeschlagen" });
    } finally { setBusy(false); }
  }

  if (!loaded) {
    return <Card className="shadow-soft"><CardContent className="py-8 text-center text-muted-foreground">Lade SFTP-Einstellungen…</CardContent></Card>;
  }

  const disabled = !canManage || busy;

  return (
    <Card className="shadow-soft">
      <CardContent className="space-y-4 p-5">
        <div>
          <h3 className="font-display text-lg text-foreground">SFTP-Anbindung (Warenwirtschaft)</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            DocklyLogistics verbindet sich als Client mit eurem SFTP-Server. Der <b>Ausgangsordner</b>{" "}
            wird gepollt: fertige EDIFACT-Dateien der WaWi werden automatisch an den Partner (per Empfänger-GLN)
            übertragen. Empfangene Bestellungen legen wir im <b>Eingangsordner</b> ab.
          </p>
        </div>

        <FlashBanner flash={flash} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Host</label>
            <Input value={form.host} disabled={disabled} onChange={(e) => set("host", e.target.value)} placeholder="sftp.intern.example / 172.16.x.x" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Port</label>
            <Input value={form.port} disabled={disabled} onChange={(e) => set("port", e.target.value)} placeholder="22" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Benutzer</label>
            <Input value={form.username} disabled={disabled} onChange={(e) => set("username", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Auth</label>
            <select className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" value={form.authType} disabled={disabled} onChange={(e) => set("authType", e.target.value as Form["authType"])}>
              <option value="KEY">Privater Schlüssel</option>
              <option value="PASSWORD">Passwort</option>
            </select>
          </div>
          <div className="flex items-end">
            <span className="text-xs text-muted-foreground">
              {(form.authType === "KEY" ? view?.hasPrivateKey : view?.hasPassword) ? "hinterlegt ✓" : "noch nicht gesetzt"}
            </span>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {form.authType === "KEY" ? "Privater Schlüssel (PEM/OpenSSH)" : "Passwort"}
          </label>
          {form.authType === "KEY" ? (
            <textarea
              value={form.secret} disabled={disabled} onChange={(e) => set("secret", e.target.value)} rows={3}
              placeholder={view?.hasPrivateKey ? "hinterlegt — leer lassen zum Behalten, neuen Key einfügen zum Ersetzen" : "-----BEGIN OPENSSH PRIVATE KEY-----"}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs"
            />
          ) : (
            <Input type="password" value={form.secret} disabled={disabled} onChange={(e) => set("secret", e.target.value)} placeholder={view?.hasPassword ? "hinterlegt — leer lassen zum Behalten" : "Passwort"} />
          )}
          <p className="mt-1 text-xs text-muted-foreground">Wird AES-verschlüsselt gespeichert und nie zurückgegeben.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Ausgangsordner (WaWi → Partner)</label>
            <Input value={form.outboxDir} disabled={disabled} onChange={(e) => set("outboxDir", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Eingangsordner (→ WaWi)</label>
            <Input value={form.inboxDir} disabled={disabled} onChange={(e) => set("inboxDir", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Eingangs-Format (für die WaWi)</label>
            <select className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" value={form.inboxFormat} disabled={disabled} onChange={(e) => set("inboxFormat", e.target.value as Form["inboxFormat"])}>
              <option value="XML">XML (Standard)</option>
              <option value="EDIFACT">EDIFACT (roh)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Routing (Ausgang)</label>
            <select className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" value={form.routing} disabled={disabled} onChange={(e) => set("routing", e.target.value as Form["routing"])}>
              <option value="FILE">Empfänger aus der Datei (EDIFACT-UNB)</option>
              <option value="SUBFOLDER">Unterordner je Partner-GLN</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Host-Key-Fingerprint (optional, SHA256)</label>
            <Input value={form.hostKeyFingerprint} disabled={disabled} onChange={(e) => set("hostKeyFingerprint", e.target.value)} placeholder="MITM-Schutz — leer = keine Prüfung" />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 border-t border-border pt-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={form.active} disabled={disabled} onChange={(e) => set("active", e.target.checked)} />
            Anbindung aktiv
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={form.autoSend} disabled={disabled} onChange={(e) => set("autoSend", e.target.checked)} />
            Ausgangsordner automatisch versenden (Cron)
          </label>
        </div>

        {view && (
          <div className="text-xs text-muted-foreground">
            Zuletzt abgerufen: {fmt(view.lastPolledAt)}
            {view.lastPollError && <span className="ml-2 text-rose-600">· letzter Fehler: {view.lastPollError}</span>}
          </div>
        )}

        {canManage && (
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button variant="outline" className="text-xs" disabled={busy || !view} onClick={() => act("test", (d) => d.message ?? "Verbindung ok")}>
              Verbindung testen
            </Button>
            <Button variant="outline" className="text-xs" disabled={busy || !view} onClick={() => act("poll-now", (d) => `Abruf: ${d.processed ?? 0} verarbeitet, ${d.sent ?? 0} gesendet`)}>
              Jetzt abrufen
            </Button>
            <Button
              disabled={busy || form.host.trim().length === 0 || form.username.trim().length === 0}
              onClick={save}
              className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900"
            >
              {busy ? "Speichere…" : "Speichern"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
