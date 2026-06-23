"use client";

import { FlashBanner } from "@/components/ui/flash-banner";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type WebhookRow = {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  description: string | null;
  lastDeliveredAt: string | null;
  createdAt: string;
};

type DeliveryRow = {
  id: string;
  event: string;
  status: string;
  attempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
  nextAttemptAt: string;
  succeededAt: string | null;
  givenUpAt: string | null;
  createdAt: string;
};

const ALL_EVENTS = [
  "order.sent",
  "order.confirmed",
  "order.partially_received",
  "order.received",
  "order.cancelled",
];

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-muted text-foreground",
  SUCCESS: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-gold-50 text-gold-700",
  GIVEN_UP: "bg-rose-50 text-rose-700",
};

export function WebhooksTab({
  webhooks,
  canManage,
}: {
  webhooks: WebhookRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [newSecret, setNewSecret] = useState<{
    id: string;
    secret: string;
    rotated?: boolean;
  } | null>(null);
  const [deliveryView, setDeliveryView] = useState<{
    webhookId: string;
    rows: DeliveryRow[];
  } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  async function toggleActive(w: WebhookRow) {
    const r = await fetch(`/api/v1/settings/webhooks/${w.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !w.active }),
    });
    if (r.ok) startTransition(() => router.refresh());
    else setMessage({ ok: false, text: "Aktualisierung fehlgeschlagen" });
  }

  async function deleteWebhook(w: WebhookRow) {
    if (!confirm(`Webhook ${w.url} wirklich löschen?`)) return;
    const r = await fetch(`/api/v1/settings/webhooks/${w.id}`, {
      method: "DELETE",
    });
    if (r.status === 204) {
      setMessage({ ok: true, text: "Webhook gelöscht" });
      startTransition(() => router.refresh());
    } else setMessage({ ok: false, text: "Löschen fehlgeschlagen" });
  }

  async function rotate(w: WebhookRow) {
    if (
      !confirm(
        `Secret von ${w.url} rotieren? Alte Signaturen werden ungültig.`,
      )
    )
      return;
    const r = await fetch(
      `/api/v1/settings/webhooks/${w.id}/rotate-secret`,
      { method: "POST" },
    );
    const body = await r.json();
    if (r.ok) {
      setNewSecret({ id: w.id, secret: body.data.secret, rotated: true });
    } else setMessage({ ok: false, text: body.detail ?? "Rotation fehlgeschlagen" });
  }

  async function viewDeliveries(w: WebhookRow) {
    const r = await fetch(`/api/v1/settings/webhooks/${w.id}/deliveries`);
    const body = await r.json();
    if (r.ok) setDeliveryView({ webhookId: w.id, rows: body.data ?? [] });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground max-w-3xl">
        Webhooks senden Events an externe URLs sobald sie auftreten (z. B.{" "}
        <code>order.sent</code>). Jede Auslieferung ist mit{" "}
        <code>X-DocklyLogistics-Signature</code> HMAC-SHA256-signiert, Timestamp
        im Header. Retries: exponentielles Backoff, max. 8 Versuche.
      </p>

      <FlashBanner flash={message} />

      {newSecret && (
        <Card className="shadow-soft border-gold-400">
          <CardContent className="p-4 space-y-2">
            <div className="text-[11px] tracking-[0.18em] uppercase text-gold-700">
              {newSecret.rotated ? "Neues Secret (Rotation)" : "Neues Secret"}
            </div>
            <pre className="text-xs font-mono bg-muted/40 border border-border rounded-lg p-3 whitespace-pre-wrap break-all">
              {newSecret.secret}
            </pre>
            <p className="text-xs text-rose-700">
              Speichere dieses Secret jetzt — es wird nie wieder angezeigt.
              Verwende es zur HMAC-Verifikation eingehender Webhook-Calls.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setNewSecret(null)}
            >
              Schließen
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-soft">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-lg text-foreground">
            Webhooks ({webhooks.length})
          </h2>
          {canManage && (
            <Button
              onClick={() => setCreating(true)}
              className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900 text-sm"
            >
              + Neuer Webhook
            </Button>
          )}
        </div>
        {webhooks.length === 0 ? (
          <div className="px-5 py-8 text-center text-muted-foreground text-sm">
            Noch keine Webhooks konfiguriert.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {webhooks.map((w) => (
              <li key={w.id} className="px-5 py-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-foreground truncate max-w-md">
                        {w.url}
                      </span>
                      {w.active ? (
                        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                          aktiv
                        </Badge>
                      ) : (
                        <Badge className="bg-muted text-muted-foreground">
                          inaktiv
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {w.events.map((e) => (
                        <span
                          key={e}
                          className="text-[10px] tracking-wide px-2 py-0.5 rounded-full bg-muted text-foreground"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                    {w.description && (
                      <div className="text-xs text-muted-foreground">
                        {w.description}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Erstellt{" "}
                      {new Date(w.createdAt).toLocaleDateString("de-DE")}
                      {w.lastDeliveredAt && (
                        <>
                          {" "}
                          · zuletzt zugestellt{" "}
                          {new Date(w.lastDeliveredAt).toLocaleString("de-DE", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => viewDeliveries(w)}
                    >
                      Deliveries
                    </Button>
                    {canManage && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleActive(w)}
                      >
                        {w.active ? "Deaktivieren" : "Aktivieren"}
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rotate(w)}
                      >
                        Secret rotieren
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-rose-700 border-rose-200 hover:bg-rose-50"
                        onClick={() => deleteWebhook(w)}
                      >
                        Löschen
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {creating && (
        <CreateWebhookDialog
          onClose={() => setCreating(false)}
          onCreated={(secret, id) => {
            setCreating(false);
            setNewSecret({ id, secret });
            startTransition(() => router.refresh());
          }}
        />
      )}

      {deliveryView && (
        <DeliveryDialog
          webhookId={deliveryView.webhookId}
          rows={deliveryView.rows}
          onClose={() => setDeliveryView(null)}
        />
      )}
    </div>
  );
}

function CreateWebhookDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (secret: string, id: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["order.sent"]);
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleEvent(e: string) {
    setEvents((cur) =>
      cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e],
    );
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/v1/settings/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        events,
        description: description || undefined,
        active,
      }),
    });
    const body = await r.json();
    setBusy(false);
    if (r.ok) onCreated(body.data.secret, body.data.id);
    else setErr(body.detail ?? body.title ?? "Fehler");
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className="p-5 space-y-3">
          <h3 className="font-display text-xl text-foreground">Neuer Webhook</h3>
          <label className="block text-sm">
            <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-1">
              URL
            </div>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/hooks/dockly"
            />
          </label>
          <div className="text-sm">
            <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-1">
              Events
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_EVENTS.map((e) => (
                <label
                  key={e}
                  className={
                    "px-3 py-1.5 rounded-lg border text-xs cursor-pointer " +
                    (events.includes(e)
                      ? "bg-navy-900 text-white dark:bg-gold-500 dark:text-navy-900 border-navy-900"
                      : "bg-card text-foreground border-border")
                  }
                >
                  <input
                    type="checkbox"
                    checked={events.includes(e)}
                    onChange={() => toggleEvent(e)}
                    className="sr-only"
                  />
                  {e}
                </label>
              ))}
            </div>
          </div>
          <label className="block text-sm">
            <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-1">
              Beschreibung (optional)
            </div>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="z.B. Slack-Notify, ERP-Sync"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />{" "}
            Webhook aktivieren
          </label>
          {err && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {err}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Abbrechen
            </Button>
            <Button
              onClick={submit}
              disabled={busy || !url || events.length === 0}
              className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900"
            >
              {busy ? "Speichere…" : "Anlegen"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DeliveryDialog({
  webhookId,
  rows: initialRows,
  onClose,
}: {
  webhookId: string;
  rows: DeliveryRow[];
  onClose: () => void;
}) {
  const [rows, setRows] = useState<DeliveryRow[]>(initialRows);
  const [retrying, setRetrying] = useState<string | null>(null);

  async function retry(deliveryId: string) {
    setRetrying(deliveryId);
    try {
      const r = await fetch(
        `/api/v1/settings/webhooks/${webhookId}/deliveries/${deliveryId}/retry`,
        { method: "POST" },
      );
      if (r.ok) {
        setRows((prev) =>
          prev.map((d) =>
            d.id === deliveryId
              ? { ...d, status: "PENDING", attempts: 0, lastError: null, givenUpAt: null }
              : d,
          ),
        );
      }
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-3xl shadow-soft max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className="p-5 space-y-3 overflow-auto">
          <h3 className="font-display text-xl text-foreground">
            Letzte Auslieferungen
          </h3>
          {rows.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-sm">
              Noch keine Auslieferungen.
            </div>
          ) : (
            <>
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-[11px] tracking-[0.16em] uppercase text-muted-foreground">
                  <th className="text-left font-medium px-3 py-2">Event</th>
                  <th className="text-left font-medium px-3 py-2">Status</th>
                  <th className="text-left font-medium px-3 py-2">Versuch</th>
                  <th className="text-left font-medium px-3 py-2">HTTP</th>
                  <th className="text-left font-medium px-3 py-2">Wann</th>
                  <th className="text-right font-medium px-3 py-2">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{d.event}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium " +
                          (STATUS_STYLES[d.status] ??
                            "bg-muted text-foreground")
                        }
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                        {d.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{d.attempts}</td>
                    <td className="px-3 py-2 text-xs">
                      {d.lastStatusCode ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(d.createdAt).toLocaleString("de-DE", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {d.status === "FAILED" || d.status === "GIVEN_UP" ? (
                        <Button
                          variant="outline"
                          className="text-xs px-2 py-1"
                          disabled={retrying === d.id}
                          onClick={() => retry(d.id)}
                        >
                          {retrying === d.id ? "…" : "Erneut senden"}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {/* Mobile: cards instead of a horizontally-scrolling table */}
            <div className="divide-y divide-border md:hidden">
              {rows.map((d) => (
                <div
                  key={d.id}
                  className="flex items-start justify-between gap-2 px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-foreground">{d.event}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className={
                          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium " +
                          (STATUS_STYLES[d.status] ?? "bg-muted text-foreground")
                        }
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                        {d.status}
                      </span>
                      <span className="text-xs text-muted-foreground">Versuch {d.attempts}</span>
                      <span className="text-xs text-muted-foreground">· HTTP {d.lastStatusCode ?? "—"}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(d.createdAt).toLocaleString("de-DE", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  </div>
                  {(d.status === "FAILED" || d.status === "GIVEN_UP") && (
                    <Button
                      variant="outline"
                      className="shrink-0 px-2 py-1 text-xs"
                      disabled={retrying === d.id}
                      onClick={() => retry(d.id)}
                    >
                      {retrying === d.id ? "…" : "Erneut senden"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
            </>
          )}
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              Schließen
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
