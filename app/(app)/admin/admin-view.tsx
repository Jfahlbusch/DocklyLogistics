"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlashBanner } from "@/components/ui/flash-banner";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

type FeatureDef = { key: string; label: string; group: string };
type TenantRow = {
  id: string; name: string; users: number;
  profile: { id: string; name: string } | null;
  overridesOn: number; overridesOff: number; createdAt: string;
};
type ProfileRow = {
  id: string; name: string; description: string | null;
  features: Record<string, boolean>; tenants: number; updatedAt: string;
};
type TenantDetail = {
  tenant: { id: string; name: string };
  profile: { id: string; name: string } | null;
  overrides: Record<string, boolean>;
  profileFeatures: Record<string, boolean> | null;
  effective: Record<string, boolean>;
};

function grouped(features: FeatureDef[]) {
  const out: { group: string; items: FeatureDef[] }[] = [];
  for (const f of features) {
    let g = out.find((x) => x.group === f.group);
    if (!g) { g = { group: f.group, items: [] }; out.push(g); }
    g.items.push(f);
  }
  return out;
}

export function AdminView({
  initialTenants, initialProfiles, features,
}: {
  initialTenants: TenantRow[];
  initialProfiles: ProfileRow[];
  features: FeatureDef[];
}) {
  const [tenants, setTenants] = useState(initialTenants);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // tenant detail dialog
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // profile dialog (create/edit)
  const [profileDialog, setProfileDialog] = useState<null | { id?: string; name: string; description: string; features: Record<string, boolean> }>(null);

  const groups = grouped(features);

  async function refreshTenants() {
    const r = await fetch("/api/v1/admin/tenants");
    if (r.ok) setTenants((await r.json()).data);
  }
  async function refreshProfiles() {
    const r = await fetch("/api/v1/admin/feature-profiles");
    if (r.ok) setProfiles((await r.json()).data);
  }

  async function openTenant(id: string) {
    setDetailOpen(true);
    setDetail(null);
    const r = await fetch(`/api/v1/admin/tenants/${id}/features`);
    if (r.ok) setDetail((await r.json()).data);
    else {
      setDetailOpen(false);
      setFlash({ ok: false, text: "Tenant konnte nicht geladen werden" });
    }
  }

  async function putTenant(id: string, body: { features?: Record<string, boolean | null>; profileId?: string | null }) {
    setBusy(true);
    try {
      const r = await fetch(`/api/v1/admin/tenants/${id}/features`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const b = await r.json().catch(() => ({}));
      if (r.ok) {
        setDetail(b.data as TenantDetail);
        refreshTenants();
      } else {
        setFlash({ ok: false, text: b.detail ?? b.title ?? "Speichern fehlgeschlagen" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    if (!profileDialog) return;
    setBusy(true);
    try {
      const isEdit = !!profileDialog.id;
      const r = await fetch(
        isEdit ? `/api/v1/admin/feature-profiles/${profileDialog.id}` : "/api/v1/admin/feature-profiles",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: profileDialog.name,
            description: profileDialog.description || undefined,
            features: profileDialog.features,
          }),
        },
      );
      const b = await r.json().catch(() => ({}));
      if (r.ok) {
        setFlash({ ok: true, text: isEdit ? "Profil aktualisiert" : "Profil angelegt" });
        setProfileDialog(null);
        refreshProfiles();
        refreshTenants();
      } else {
        setFlash({ ok: false, text: b.detail ?? b.title ?? "Speichern fehlgeschlagen" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteProfile(p: ProfileRow) {
    const hint = p.tenants > 0 ? ` ${p.tenants} Tenant(s) fallen auf „alles verfügbar“ zurück.` : "";
    if (!confirm(`Profil „${p.name}“ wirklich löschen?${hint}`)) return;
    const r = await fetch(`/api/v1/admin/feature-profiles/${p.id}`, { method: "DELETE" });
    if (r.status === 204) {
      setFlash({ ok: true, text: `Profil „${p.name}“ gelöscht` });
      refreshProfiles();
      refreshTenants();
    } else {
      const b = await r.json().catch(() => ({}));
      setFlash({ ok: false, text: b.detail ?? b.title ?? "Löschen fehlgeschlagen" });
    }
  }

  function newProfileDraft() {
    // start with everything available
    setProfileDialog({
      name: "",
      description: "",
      features: Object.fromEntries(features.map((f) => [f.key, true])),
    });
  }
  function editProfileDraft(p: ProfileRow) {
    setProfileDialog({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      // merge stored map over all-on so every feature has an explicit toggle
      features: { ...Object.fromEntries(features.map((f) => [f.key, true])), ...p.features },
    });
  }

  return (
    <div className="space-y-4 max-w-app">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-foreground">Administration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Betreiber-Ebene: Funktionen pro Tenant freischalten oder sperren — Sperren gelten
          für alle Benutzer des Tenants, unabhängig von Rollen und Einzelrechten.
        </p>
      </div>

      <FlashBanner flash={flash} />

      <Tabs defaultValue="tenants">
        <TabsList>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="profiles">Funktionsprofile</TabsTrigger>
        </TabsList>

        {/* ---------------- Tenants ---------------- */}
        <TabsContent value="tenants" className="mt-4">
          <Card className="shadow-soft">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-[11px] tracking-[0.16em] uppercase text-muted-foreground">
                    <th className="text-left font-medium px-4 py-3">Tenant</th>
                    <th className="text-left font-medium px-4 py-3">Benutzer</th>
                    <th className="text-left font-medium px-4 py-3">Funktionsprofil</th>
                    <th className="text-left font-medium px-4 py-3">Einzel-Sperren</th>
                    <th className="text-left font-medium px-4 py-3">Angelegt</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.id} onClick={() => openTenant(t.id)} className="border-t border-border hover:bg-muted/40 cursor-pointer">
                      <td className="px-4 py-3 font-medium text-foreground">{t.name}</td>
                      <td className="px-4 py-3">{t.users}</td>
                      <td className="px-4 py-3">{t.profile?.name ?? <span className="text-muted-foreground">— alles verfügbar —</span>}</td>
                      <td className="px-4 py-3">
                        {t.overridesOff > 0 && <span className="text-rose-600">{t.overridesOff} gesperrt</span>}
                        {t.overridesOff > 0 && t.overridesOn > 0 && " · "}
                        {t.overridesOn > 0 && <span className="text-emerald-600">{t.overridesOn} freigeschaltet</span>}
                        {t.overridesOff === 0 && t.overridesOn === 0 && <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(t.createdAt).toLocaleDateString("de-DE")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: cards instead of a horizontally-scrolling table */}
            <div className="divide-y divide-border md:hidden">
              {tenants.map((t) => (
                <button key={t.id} type="button" onClick={() => openTenant(t.id)} className="flex w-full flex-col gap-1 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/40">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-foreground">{t.name}</span>
                    <span className="text-xs text-muted-foreground">{t.users} Benutzer</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t.profile?.name ?? "alles verfügbar"}
                    {t.overridesOff > 0 && ` · ${t.overridesOff} gesperrt`}
                    {t.overridesOn > 0 && ` · ${t.overridesOn} frei`}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* ---------------- Profile ---------------- */}
        <TabsContent value="profiles" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={newProfileDraft} className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900">
              + Neues Profil
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {profiles.length === 0 && (
              <Card className="shadow-soft lg:col-span-2">
                <CardContent className="py-10 text-center text-muted-foreground">
                  Noch keine Funktionsprofile. Lege z. B. „Basis“ oder „Vollzugriff“ an und
                  weise sie Tenants zu.
                </CardContent>
              </Card>
            )}
            {profiles.map((p) => {
              const off = features.filter((f) => p.features[f.key] === false).length;
              return (
                <Card key={p.id} className="shadow-soft">
                  <CardContent className="space-y-2 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-display text-lg text-foreground">{p.name}</div>
                        {p.description && <div className="text-sm text-muted-foreground">{p.description}</div>}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button variant="outline" className="px-2 py-1 text-xs" onClick={() => editProfileDraft(p)}>Bearbeiten</Button>
                        <Button variant="outline" className="px-2 py-1 text-xs text-danger" onClick={() => deleteProfile(p)}>Löschen</Button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {off === 0 ? "Alle Funktionen verfügbar" : `${off} Funktion(en) gesperrt`} ·
                      {" "}verwendet von {p.tenants} Tenant(s)
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* ---------------- Tenant-Detail ---------------- */}
      <Dialog open={detailOpen} onOpenChange={(o) => { if (!o) { setDetailOpen(false); setDetail(null); } }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Funktionen · {detail?.tenant.name ?? "…"}</DialogTitle>
            <DialogDescription>
              Sperren wirken für alle Benutzer des Tenants. Reihenfolge: Einzel-Regel → Profil → Standard (verfügbar).
            </DialogDescription>
          </DialogHeader>

          {!detail ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Lade…</div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Funktionsprofil</span>
                <select
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  value={detail.profile?.id ?? ""}
                  disabled={busy}
                  onChange={(e) => putTenant(detail.tenant.id, { profileId: e.target.value || null })}
                >
                  <option value="">— kein Profil (alles verfügbar) —</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                {groups.map((g) => (
                  <div key={g.group}>
                    <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{g.group}</div>
                    <div className="divide-y divide-border rounded-lg border border-border">
                      {g.items.map((f) => {
                        const ovr = detail.overrides[f.key]; // true | false | undefined
                        const state: "inherit" | "on" | "off" = ovr === undefined ? "inherit" : ovr ? "on" : "off";
                        const fromProfile = detail.profileFeatures?.[f.key];
                        const effective = detail.effective[f.key];
                        return (
                          <div key={f.key} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                            <span className="min-w-0 text-foreground">
                              <span className={cn("mr-2 inline-block h-2 w-2 rounded-full", effective ? "bg-emerald-500" : "bg-rose-500")} />
                              {f.label}
                              <span className="ml-2 text-[10px] text-muted-foreground">
                                {fromProfile === undefined ? "Standard: verfügbar" : `Profil: ${fromProfile ? "verfügbar" : "gesperrt"}`}
                              </span>
                            </span>
                            <div className="inline-flex shrink-0 self-start rounded-md border border-border sm:self-auto">
                              {([
                                ["inherit", detail.profile ? "Profil" : "Standard", null],
                                ["on", "Erlaubt", true],
                                ["off", "Gesperrt", false],
                              ] as const).map(([key, label, value]) => (
                                <button
                                  key={key}
                                  disabled={busy}
                                  onClick={() => putTenant(detail.tenant.id, { features: { [f.key]: value } })}
                                  className={cn(
                                    "px-2.5 py-1.5 text-xs transition-colors first:rounded-l-md last:rounded-r-md",
                                    state === key
                                      ? key === "off"
                                        ? "bg-rose-600 text-white"
                                        : key === "on"
                                          ? "bg-emerald-600 text-white"
                                          : "bg-navy-900 text-white dark:bg-gold-500 dark:text-navy-900"
                                      : "text-muted-foreground hover:text-foreground",
                                  )}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------------- Profil-Dialog ---------------- */}
      <Dialog open={profileDialog !== null} onOpenChange={(o) => { if (!o) setProfileDialog(null); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {profileDialog?.id ? "Funktionsprofil bearbeiten" : "Neues Funktionsprofil"}
            </DialogTitle>
            <DialogDescription>
              Häkchen = Funktion verfügbar. Änderungen wirken sofort auf alle zugeordneten Tenants.
            </DialogDescription>
          </DialogHeader>

          {profileDialog && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Name</label>
                  <Input
                    value={profileDialog.name}
                    onChange={(e) => setProfileDialog({ ...profileDialog, name: e.target.value })}
                    placeholder="z. B. Basis Lager"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Beschreibung</label>
                  <Input
                    value={profileDialog.description}
                    onChange={(e) => setProfileDialog({ ...profileDialog, description: e.target.value })}
                    placeholder="optional"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {groups.map((g) => (
                  <div key={g.group}>
                    <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{g.group}</div>
                    <div className="divide-y divide-border rounded-lg border border-border">
                      {g.items.map((f) => (
                        <label key={f.key} className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5">
                          <span className="text-foreground">{f.label}</span>
                          <input
                            type="checkbox"
                            checked={profileDialog.features[f.key] !== false}
                            onChange={(e) =>
                              setProfileDialog({
                                ...profileDialog,
                                features: { ...profileDialog.features, [f.key]: e.target.checked },
                              })
                            }
                            className="h-4 w-4 accent-navy-900 dark:accent-gold-500"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setProfileDialog(null)}>Abbrechen</Button>
                <Button
                  disabled={busy || profileDialog.name.trim().length === 0}
                  onClick={saveProfile}
                  className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900"
                >
                  {busy ? "Speichere…" : "Speichern"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
