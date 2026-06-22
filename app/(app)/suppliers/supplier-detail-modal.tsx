"use client";

import { DetailField as Field } from "@/components/ui/detail-field";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SupplierForm, type SupplierFormValues } from "./supplier-form";

type Supplier = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  channel: "EMAIL" | "API" | "EDI";
  channelConfig: unknown;
  active: boolean;
};

export function SupplierDetailModal({
  supplierId,
  canManage,
  onClose,
  onDeleted,
  onUpdated,
}: {
  supplierId: string | null;
  canManage: boolean;
  onClose: () => void;
  onDeleted?: (name: string) => void;
  onUpdated?: (name: string) => void;
}) {
  const open = supplierId !== null;
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    setEditing(false);
    setEditError(null);
    if (!supplierId) {
      setSupplier(null);
      return;
    }
    setLoading(true);
    fetch(`/api/v1/suppliers/${supplierId}`)
      .then((r) => r.json())
      .then((body) => setSupplier(body?.data ?? null))
      .finally(() => setLoading(false));
  }, [supplierId]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl sm:max-w-3xl">
        {loading || !supplier ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>Lieferanten-Detail wird geladen</DialogTitle>
            </DialogHeader>
            <div className="py-10 text-center text-muted-foreground">Lade…</div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground font-mono">
                {supplier.id}
              </div>
              <DialogTitle className="font-display text-2xl text-foreground">
                {supplier.name}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {[supplier.contactName, supplier.city, supplier.email]
                  .filter(Boolean)
                  .join(" · ")}
              </DialogDescription>
            </DialogHeader>

            {!editing && (
              <Tabs defaultValue="stamm">
                <TabsList>
                  <TabsTrigger value="stamm">Stamm</TabsTrigger>
                  <TabsTrigger value="kanal">Kanal</TabsTrigger>
                  <TabsTrigger value="orders">Bestellungen</TabsTrigger>
                  <TabsTrigger value="api-keys">API-Keys</TabsTrigger>
                </TabsList>

                <TabsContent value="stamm" className="space-y-2 text-sm mt-4">
                  <Field label="Name" value={supplier.name} />
                  <Field label="Kontakt" value={supplier.contactName ?? "—"} />
                  <Field label="E-Mail" value={supplier.email ?? "—"} mono />
                  <Field label="Telefon" value={supplier.phone ?? "—"} />
                  <Field label="Straße" value={supplier.street ?? "—"} />
                  <Field
                    label="PLZ / Ort"
                    value={`${supplier.postalCode ?? "—"} ${supplier.city ?? ""}`.trim()}
                  />
                  <Field label="Land" value={supplier.country ?? "—"} />
                  <Field label="Status" value={supplier.active ? "aktiv" : "inaktiv"} />
                </TabsContent>

                <TabsContent value="kanal" className="space-y-4 mt-4">
                  <div className="flex gap-2">
                    {(["EMAIL", "API", "EDI"] as const).map((c) => (
                      <div
                        key={c}
                        className={
                          "flex-1 rounded-xl border px-4 py-3 text-left " +
                          (supplier.channel === c
                            ? "bg-navy-900 text-white dark:bg-gold-500 dark:text-navy-900 border-navy-900"
                            : "bg-card text-muted-foreground border-border")
                        }
                      >
                        <div className="font-medium">{c}</div>
                        <div className="text-xs mt-1 opacity-80">
                          {c === "EMAIL"
                            ? "PDF-Bestellschein per Mail"
                            : c === "API"
                              ? "JSON HTTP POST"
                              : "EDIFACT/ORDERS D.96A"}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border border-border rounded-xl p-4 bg-muted/40">
                    <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
                      Empfänger-Konfiguration
                    </div>
                    <pre className="text-xs font-mono whitespace-pre-wrap break-words text-foreground">
                      {JSON.stringify(supplier.channelConfig ?? {}, null, 2)}
                    </pre>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Die Tenant-seitige Absender-Identität (z. B. Mailadresse, EDI-Sender-ID) wird
                    unter
                    <strong className="text-foreground"> Einstellungen → Versand </strong>
                    konfiguriert.
                  </div>
                </TabsContent>

                <TabsContent value="orders" className="mt-4">
                  <SupplierOrdersPanel supplierId={supplier.id} />
                </TabsContent>

                <TabsContent value="api-keys" className="mt-4">
                  <ApiKeysPanel supplierId={supplier.id} canManage={canManage} />
                </TabsContent>
              </Tabs>
            )}

            {editing && supplier && (
              <SupplierForm
                initial={supplierToFormValues(supplier)}
                isCreate={false}
                busy={editBusy}
                errorMessage={editError}
                onCancel={() => {
                  setEditing(false);
                  setEditError(null);
                }}
                onSubmit={async (values) => {
                  setEditBusy(true);
                  setEditError(null);
                  try {
                    const r = await fetch(`/api/v1/suppliers/${supplier.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(values),
                    });
                    const body = await r.json();
                    if (r.ok) {
                      setEditing(false);
                      const fresh = await fetch(`/api/v1/suppliers/${supplier.id}`).then((res) =>
                        res.json(),
                      );
                      setSupplier(fresh?.data ?? null);
                      onUpdated?.(values.name);
                    } else {
                      setEditError(body.detail ?? body.title ?? "Fehler beim Speichern");
                    }
                  } finally {
                    setEditBusy(false);
                  }
                }}
              />
            )}

            {!editing && supplier && canManage && (
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  className="text-rose-600 border-rose-200 hover:bg-rose-50"
                  onClick={async () => {
                    if (!confirm(`Lieferant "${supplier.name}" wirklich löschen?`)) return;
                    const r = await fetch(`/api/v1/suppliers/${supplier.id}`, {
                      method: "DELETE",
                    });
                    if (r.status === 204) {
                      onDeleted?.(supplier.name);
                      onClose();
                    } else {
                      const body = await r.json().catch(() => ({}));
                      alert(body.detail ?? body.title ?? "Löschen fehlgeschlagen");
                    }
                  }}
                >
                  Löschen
                </Button>
                <Button
                  onClick={() => setEditing(true)}
                  className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900"
                >
                  Bearbeiten
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function supplierToFormValues(s: Supplier): SupplierFormValues {
  return {
    name: s.name,
    contactName: s.contactName ?? undefined,
    email: s.email ?? undefined,
    phone: s.phone ?? undefined,
    street: s.street ?? undefined,
    city: s.city ?? undefined,
    postalCode: s.postalCode ?? undefined,
    country: s.country ?? undefined,
    channel: s.channel,
    channelConfig: (s.channelConfig ?? {}) as Record<string, unknown>,
    active: s.active,
  };
}


type SupplierOrder = {
  id: string;
  orderNo: string;
  status: string;
  total: string;
  currency: string;
  createdAt: string;
  sentAt: string | null;
  _count?: { items: number };
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

function SupplierOrdersPanel({ supplierId }: { supplierId: string }) {
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/v1/orders?supplierId=${supplierId}&pageSize=20`)
      .then((r) => r.json())
      .then((body) => { if (!cancelled) { setOrders(body?.data ?? []); setLoading(false); } });
    return () => { cancelled = true; };
  }, [supplierId]);

  if (loading) return <div className="py-6 text-center text-muted-foreground text-sm">Lade Bestellungen…</div>;
  if (orders.length === 0) {
    return <div className="py-6 text-center text-muted-foreground text-sm">Noch keine Bestellungen für diesen Lieferanten.</div>;
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/40 text-[11px] tracking-[0.16em] uppercase text-muted-foreground">
            <th className="text-left font-medium px-3 py-2">Nr.</th>
            <th className="text-left font-medium px-3 py-2">Status</th>
            <th className="text-left font-medium px-3 py-2">Pos.</th>
            <th className="text-right font-medium px-3 py-2">Summe</th>
            <th className="text-left font-medium px-3 py-2">Erstellt</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-t border-border">
              <td className="px-3 py-2 font-mono text-xs">{o.orderNo}</td>
              <td className="px-3 py-2">
                <span className={"inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium " + (STATUS_STYLES[o.status] ?? "bg-muted text-foreground")}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />{o.status}
                </span>
              </td>
              <td className="px-3 py-2 text-xs">{o._count?.items ?? "—"}</td>
              <td className="px-3 py-2 text-right font-medium">{Number(o.total).toFixed(2)} {o.currency}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("de-DE")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ApiKeyRow = {
  id: string;
  label: string | null;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

const SCOPES = ["orders:read", "orders:confirm", "deliveries:write"];

function ApiKeysPanel({
  supplierId,
  canManage,
}: {
  supplierId: string;
  canManage: boolean;
}) {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<{ prefix: string; fullKey: string } | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/v1/suppliers/${supplierId}/api-keys`);
    const body = await r.json();
    setKeys(body?.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  async function createKey(label: string, scopes: string[]) {
    const r = await fetch(`/api/v1/suppliers/${supplierId}/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, scopes }),
    });
    const body = await r.json();
    if (r.ok) {
      setNewKey({ prefix: body.data.prefix, fullKey: body.data.fullKey });
      setCreating(false);
      await load();
    }
  }

  async function revoke(id: string) {
    if (!confirm("API-Key widerrufen? Lieferant kann diesen Key danach nicht mehr nutzen.")) return;
    await fetch(`/api/v1/suppliers/${supplierId}/api-keys/${id}`, { method: "DELETE" });
    await load();
  }

  if (loading) return <div className="py-6 text-center text-muted-foreground text-sm">Lade API-Keys…</div>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        API-Keys werden vom Lieferanten im <code>X-API-Key</code>-Header der Public-API mitgesendet
        (<code>/api/public/v1/*</code>). Das volle Key-Secret wird nur einmal angezeigt.
      </p>

      {newKey && (
        <div className="border border-gold-400 rounded-xl p-3 bg-gold-50 space-y-2">
          <div className="text-[11px] tracking-[0.18em] uppercase text-gold-700">Neuer API-Key</div>
          <pre className="text-xs font-mono bg-card border border-border rounded p-2 whitespace-pre-wrap break-all">
            {newKey.fullKey}
          </pre>
          <p className="text-xs text-rose-700">
            Speichere den vollen Key jetzt — er wird nie wieder angezeigt.
          </p>
          <Button size="sm" variant="outline" onClick={() => setNewKey(null)}>
            Schließen
          </Button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="text-sm text-foreground">{keys.length} Key(s)</div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900"
          >
            + Neuer Key
          </Button>
        )}
      </div>

      {keys.length === 0 ? (
        <div className="py-4 text-center text-muted-foreground text-sm">Keine Keys angelegt.</div>
      ) : (
        <ul className="space-y-2">
          {keys.map((k) => (
            <li
              key={k.id}
              className="border border-border rounded-lg p-3 flex flex-wrap items-start justify-between gap-2"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs">{k.prefix}.•••</span>
                  {k.revokedAt ? (
                    <Badge className="bg-rose-50 text-rose-700">widerrufen</Badge>
                  ) : (
                    <Badge className="bg-emerald-50 text-emerald-700">aktiv</Badge>
                  )}
                  {k.label && <span className="text-xs text-muted-foreground">{k.label}</span>}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {k.scopes.map((s) => (
                    <span
                      key={s}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">
                  Erstellt {new Date(k.createdAt).toLocaleDateString("de-DE")}
                  {k.lastUsedAt && (
                    <>
                      {" "}
                      · zuletzt verwendet{" "}
                      {new Date(k.lastUsedAt).toLocaleString("de-DE", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </>
                  )}
                </div>
              </div>
              {canManage && !k.revokedAt && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-rose-700 border-rose-200 hover:bg-rose-50"
                  onClick={() => revoke(k.id)}
                >
                  Widerrufen
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {creating && <CreateKeyDialog onClose={() => setCreating(false)} onCreate={createKey} />}
    </div>
  );
}

function CreateKeyDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (label: string, scopes: string[]) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [scopes, setScopes] = useState<string[]>(["orders:read"]);
  const [busy, setBusy] = useState(false);

  function toggleScope(s: string) {
    setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  async function submit() {
    setBusy(true);
    await onCreate(label, scopes);
    setBusy(false);
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card className="w-full max-w-md shadow-soft" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-5 space-y-3">
          <h3 className="font-display text-lg text-foreground">Neuer API-Key</h3>
          <label className="block text-sm">
            <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-1">
              Bezeichnung
            </div>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="z.B. Lieferanten-Portal"
            />
          </label>
          <div className="text-sm">
            <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-1">Scopes</div>
            <div className="flex flex-wrap gap-2">
              {SCOPES.map((s) => (
                <label
                  key={s}
                  className={
                    "px-3 py-1.5 rounded-lg border text-xs cursor-pointer " +
                    (scopes.includes(s)
                      ? "bg-navy-900 text-white dark:bg-gold-500 dark:text-navy-900 border-navy-900"
                      : "bg-card text-foreground border-border")
                  }
                >
                  <input
                    type="checkbox"
                    checked={scopes.includes(s)}
                    onChange={() => toggleScope(s)}
                    className="sr-only"
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Abbrechen
            </Button>
            <Button
              onClick={submit}
              disabled={busy || scopes.length === 0}
              className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900"
            >
              {busy ? "Erstelle…" : "Erstellen"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
