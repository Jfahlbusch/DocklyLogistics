"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { WebhooksTab, type WebhookRow } from "./webhooks-tab";
import { ChannelForm, defaultChannelValues, type ChannelFormValues } from "./channel-form";

type ChannelProfile = {
  id: string;
  channel: "EMAIL" | "API" | "EDI";
  label: string;
  isDefault: boolean;
  active: boolean;
  config: Record<string, unknown>;
  updatedAt: string;
};

const CHANNEL_TITLES = { EMAIL: "E-Mail", API: "REST-API", EDI: "EDIFACT" };
const CHANNEL_DESC = {
  EMAIL: "Versand per E-Mail mit PDF-Bestellschein",
  API: "JSON-HTTP-POST an Lieferanten-Endpoint",
  EDI: "EDIFACT ORDERS D.96A über SFTP",
};

export function SettingsView({
  tenant,
  role,
  channels,
  webhooks,
  keycloak,
}: {
  tenant: string;
  role: string;
  channels: ChannelProfile[];
  webhooks: WebhookRow[];
  keycloak: { clientId: string; realm: string; url: string };
}) {
  const canManage = role === "MANAGER" || role === "GLOBAL_ADMIN";
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState<null | (typeof channelKeys)[number]>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const editingProfile = editingId ? channels.find((c) => c.id === editingId) ?? null : null;

  async function onDelete(profile: ChannelProfile) {
    if (
      !confirm(
        `Versand-Profil "${profile.label}" (${profile.channel}) wirklich löschen?`,
      )
    )
      return;
    const r = await fetch(`/api/v1/settings/channels/${profile.id}`, { method: "DELETE" });
    if (r.status === 204) {
      setFlash({ ok: true, text: `Profil "${profile.label}" gelöscht` });
      startTransition(() => router.refresh());
    } else {
      const body = await r.json().catch(() => ({}));
      setFlash({ ok: false, text: body.detail ?? body.title ?? "Löschen fehlgeschlagen" });
    }
  }

  const dialogOpen = creating !== null || editingId !== null;
  const isCreate = creating !== null;
  const initial: ChannelFormValues | null = isCreate
    ? { ...defaultChannelValues, channel: creating! }
    : editingProfile
      ? channelToFormValues(editingProfile)
      : null;

  return (
    <div className="space-y-4 max-w-app">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-foreground">Einstellungen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tenant: <span className="font-mono">{tenant}</span> · Deine Rolle: {role}
          </p>
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

      <Tabs defaultValue="versand">
        <TabsList>
          <TabsTrigger value="versand">Versand</TabsTrigger>
          <TabsTrigger value="tenant">Tenant</TabsTrigger>
          <TabsTrigger value="api-docs">API-Dokumentation</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="versand" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground max-w-3xl">
            Versand-Profile definieren, wie dieser Tenant Bestellungen <strong>versendet</strong>{" "}
            (Absender-Identität, SMTP, EDI-Sender-ID). Lieferanten-spezifische Empfänger-Konfiguration
            wird beim Lieferanten gepflegt.
          </p>

          {channelKeys.map((channelKey) => {
            const ofChannel = channels.filter((c) => c.channel === channelKey);
            return (
              <Card key={channelKey} className="shadow-soft">
                <div className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg text-foreground">
                      {CHANNEL_TITLES[channelKey]}
                    </h2>
                    <p className="text-xs text-muted-foreground">{CHANNEL_DESC[channelKey]}</p>
                  </div>
                  {canManage && (
                    <Button
                      variant="outline"
                      className="text-sm"
                      onClick={() => {
                        setCreating(channelKey);
                        setFormError(null);
                      }}
                    >
                      + Neues Profil
                    </Button>
                  )}
                </div>

                <CardContent className="p-0">
                  {ofChannel.length === 0 ? (
                    <div className="px-5 py-8 text-center text-muted-foreground text-sm">
                      Noch kein Profil für diesen Kanal konfiguriert.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {ofChannel.map((p) => (
                        <ProfileRow
                          key={p.id}
                          profile={p}
                          canManage={canManage}
                          onEdit={(id) => {
                            setEditingId(id);
                            setFormError(null);
                          }}
                          onDelete={onDelete}
                        />
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="tenant" className="mt-4">
          <Card className="shadow-soft">
            <CardContent className="p-5 space-y-2 text-sm">
              <Field label="Tenant-ID" value={tenant} mono />
              <Field label="Keycloak-Client" value={keycloak.clientId} mono />
              <Field label="Keycloak-Realm" value={keycloak.realm} mono />
              <Field label="Keycloak-URL" value={keycloak.url} mono />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-docs" className="mt-4">
          <Card className="shadow-soft">
            <CardContent className="p-5 space-y-3">
              <p className="text-sm text-muted-foreground">
                Die OpenAPI 3.1 Spezifikation wird automatisch generiert und über Scalar UI
                bereitgestellt.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/api-docs"
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-gold-500 dark:text-navy-900 text-sm font-medium hover:bg-navy-700"
                >
                  Scalar UI öffnen
                </a>
                <a
                  href="/api/v1/openapi.json"
                  className="inline-flex items-center px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted/40 font-mono"
                >
                  openapi.json
                </a>
              </div>
              <div className="mt-5 border-t border-border pt-4">
                <div className="text-sm font-medium text-foreground">Public-API (Lieferanten)</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Bestellabruf, -bestätigung und Webhook-Empfang für Lieferanten. Authentifizierung
                  über <span className="font-mono">X-API-Key</span>.
                </p>
                <div className="flex flex-wrap gap-3 mt-3">
                  <a
                    href="/api-docs/public"
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900 text-sm font-medium hover:bg-navy-700"
                  >
                    Public Scalar UI öffnen
                  </a>
                  <a
                    href="/api/public/v1/openapi.json"
                    className="inline-flex items-center px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted/40 font-mono"
                  >
                    public openapi.json
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="mt-4">
          <WebhooksTab webhooks={webhooks} canManage={canManage} />
        </TabsContent>
      </Tabs>

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(null);
            setEditingId(null);
            setFormError(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-foreground">
              {isCreate ? "Neues Versand-Profil" : "Profil bearbeiten"}
            </DialogTitle>
            <DialogDescription>Konfiguration je Kanal als JSON pflegen.</DialogDescription>
          </DialogHeader>
          {dialogOpen && initial && (
            <ChannelForm
              initial={initial}
              isCreate={isCreate}
              busy={formBusy}
              errorMessage={formError}
              onCancel={() => {
                setCreating(null);
                setEditingId(null);
                setFormError(null);
              }}
              onSubmit={async (values) => {
                setFormBusy(true);
                setFormError(null);
                try {
                  const url = isCreate
                    ? "/api/v1/settings/channels"
                    : `/api/v1/settings/channels/${editingId}`;
                  const method = isCreate ? "POST" : "PATCH";
                  // PATCH should not include 'channel' (immutable per UX; Update schema doesn't accept it)
                  const payload = isCreate
                    ? values
                    : (() => {
                        const { channel: _c, ...rest } = values;
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
                      text: isCreate ? "Profil angelegt" : "Profil gespeichert",
                    });
                    setCreating(null);
                    setEditingId(null);
                    startTransition(() => router.refresh());
                  } else {
                    setFormError(body.detail ?? body.title ?? "Fehler");
                  }
                } finally {
                  setFormBusy(false);
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const channelKeys = ["EMAIL", "API", "EDI"] as const;

function channelToFormValues(p: ChannelProfile): ChannelFormValues {
  return {
    channel: p.channel,
    label: p.label && p.label !== "(ohne Label)" ? p.label : undefined,
    isDefault: p.isDefault,
    active: p.active,
    config: (p.config ?? {}) as Record<string, unknown>,
  };
}

function ProfileRow({
  profile,
  canManage,
  onEdit,
  onDelete,
}: {
  profile: ChannelProfile;
  canManage: boolean;
  onEdit: (id: string) => void;
  onDelete: (profile: ChannelProfile) => void | Promise<void>;
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch(`/api/v1/settings/channels/${profile.id}/test`, { method: "POST" });
      const body = await r.json();
      if (r.ok) {
        setTestResult({ ok: true, message: body?.data?.message ?? "Test erfolgreich" });
      } else {
        setTestResult({
          ok: false,
          message: body?.detail ?? body?.title ?? "Test fehlgeschlagen",
        });
      }
    } catch (e) {
      setTestResult({ ok: false, message: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }

  return (
    <li className="px-5 py-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-foreground">{profile.label}</h3>
            {profile.isDefault && (
              <Badge className="bg-gold-500 text-foreground hover:bg-gold-400">Standard</Badge>
            )}
            {!profile.active && (
              <Badge variant="outline" className="text-muted-foreground">
                inaktiv
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1 font-mono">{profile.id}</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canManage && (
            <>
              <Button onClick={runTest} disabled={testing} variant="outline" className="text-sm">
                {testing ? "Teste…" : "Test-Versand"}
              </Button>
              <Button
                onClick={() => onEdit(profile.id)}
                variant="outline"
                className="text-sm"
              >
                Bearbeiten
              </Button>
              <Button
                onClick={() => onDelete(profile)}
                variant="outline"
                className="text-sm text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                Löschen
              </Button>
            </>
          )}
        </div>
      </div>

      {testResult && (
        <div
          className={
            "text-sm px-3 py-2 rounded-lg border " +
            (testResult.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700")
          }
        >
          {testResult.message}
        </div>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Konfiguration anzeigen
        </summary>
        <pre className="mt-2 bg-muted/40 border border-border rounded-lg p-3 font-mono whitespace-pre-wrap break-words text-foreground">
          {JSON.stringify(profile.config, null, 2)}
        </pre>
      </details>
    </li>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2 items-baseline">
      <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground w-40 flex-shrink-0">
        {label}
      </div>
      <div className={mono ? "font-mono text-sm" : "text-sm"}>{value}</div>
    </div>
  );
}
