"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
}: {
  tenant: string;
  role: string;
  channels: ChannelProfile[];
}) {
  const canManage = role === "MANAGER" || role === "GLOBAL_ADMIN";

  return (
    <div className="space-y-4 max-w-app">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-navy-900">Einstellungen</h1>
          <p className="text-sm text-stone-500 mt-1">
            Tenant: <span className="font-mono">{tenant}</span> · Deine Rolle: {role}
          </p>
        </div>
      </div>

      <Tabs defaultValue="versand">
        <TabsList>
          <TabsTrigger value="versand">Versand</TabsTrigger>
          <TabsTrigger value="tenant">Tenant</TabsTrigger>
          <TabsTrigger value="api-docs">API-Dokumentation</TabsTrigger>
          <TabsTrigger value="users" disabled>
            Benutzer & Freigaben (kommt)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="versand" className="mt-4 space-y-4">
          <p className="text-sm text-stone-600 max-w-3xl">
            Versand-Profile definieren, wie dieser Tenant Bestellungen <strong>versendet</strong>{" "}
            (Absender-Identität, SMTP, EDI-Sender-ID). Lieferanten-spezifische Empfänger-Konfiguration wird beim Lieferanten gepflegt.
          </p>

          {(["EMAIL", "API", "EDI"] as const).map((channelKey) => {
            const ofChannel = channels.filter((c) => c.channel === channelKey);
            return (
              <Card key={channelKey} className="shadow-soft">
                <div className="px-5 py-4 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg text-navy-900">{CHANNEL_TITLES[channelKey]}</h2>
                    <p className="text-xs text-stone-500">{CHANNEL_DESC[channelKey]}</p>
                  </div>
                  <Button
                    variant="outline"
                    className="text-sm"
                    disabled
                    title="Anlegen über die API (Scalar) oder M2-Final"
                  >
                    + Neues Profil
                  </Button>
                </div>

                <CardContent className="p-0">
                  {ofChannel.length === 0 ? (
                    <div className="px-5 py-8 text-center text-stone-500 text-sm">
                      Noch kein Profil für diesen Kanal konfiguriert.
                    </div>
                  ) : (
                    <ul className="divide-y divide-stone-100">
                      {ofChannel.map((p) => (
                        <ProfileRow key={p.id} profile={p} canManage={canManage} />
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
              <Field label="Keycloak-Client" value="docklylogistic" mono />
              <Field label="Keycloak-Realm" value="backofficedigitaldev" mono />
              <Field label="Keycloak-URL" value="https://login.backofficedigital.de/auth" mono />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-docs" className="mt-4">
          <Card className="shadow-soft">
            <CardContent className="p-5 space-y-3">
              <p className="text-sm text-stone-600">
                Die OpenAPI 3.1 Spezifikation wird automatisch generiert und über Scalar UI bereitgestellt.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/api-docs"
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-navy-900 text-white text-sm font-medium hover:bg-navy-700"
                >
                  Scalar UI öffnen
                </a>
                <a
                  href="/api/v1/openapi.json"
                  className="inline-flex items-center px-4 py-2 rounded-lg border border-stone-200 text-sm hover:bg-stone-50 font-mono"
                >
                  openapi.json
                </a>
              </div>
              <div className="text-xs text-stone-500 mt-2">
                Public-API (Lieferanten) folgt in Phase M5 unter{" "}
                <span className="font-mono text-navy-900">/api-docs/public</span>.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileRow({ profile, canManage }: { profile: ChannelProfile; canManage: boolean }) {
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
        setTestResult({ ok: false, message: body?.detail ?? body?.title ?? "Test fehlgeschlagen" });
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
            <h3 className="font-medium text-navy-900">{profile.label}</h3>
            {profile.isDefault && <Badge className="bg-gold-500 text-navy-900 hover:bg-gold-400">Standard</Badge>}
            {!profile.active && (
              <Badge variant="outline" className="text-stone-500">
                inaktiv
              </Badge>
            )}
          </div>
          <div className="text-xs text-stone-500 mt-1 font-mono">{profile.id}</div>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <Button onClick={runTest} disabled={testing} variant="outline" className="text-sm">
              {testing ? "Teste…" : "Test-Versand"}
            </Button>
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
        <summary className="cursor-pointer text-stone-500 hover:text-stone-700">Konfiguration anzeigen</summary>
        <pre className="mt-2 bg-stone-50 border border-stone-200 rounded-lg p-3 font-mono whitespace-pre-wrap break-words text-stone-800">
          {JSON.stringify(profile.config, null, 2)}
        </pre>
      </details>
    </li>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2 items-baseline">
      <div className="text-[11px] tracking-[0.18em] uppercase text-stone-500 w-40 flex-shrink-0">{label}</div>
      <div className={mono ? "font-mono text-sm" : "text-sm"}>{value}</div>
    </div>
  );
}
