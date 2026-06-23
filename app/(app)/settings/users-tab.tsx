"use client";

import { useEffect, useState } from "react";
import { FlashBanner } from "@/components/ui/flash-banner";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type FeatureDef = { key: string; label: string; group: string };
type User = { id: string; email: string; name: string | null; role: string; lastLoginAt: string | null };
type UserFeatureData = {
  effective: Record<string, boolean>;
  overrides: Record<string, boolean>;
  roleDefault: Record<string, boolean>;
};

const ROLE_LABEL: Record<string, string> = {
  GLOBAL_ADMIN: "Globaler Admin",
  MANAGER: "Manager",
  USER: "Benutzer",
  VIEWER: "Betrachter",
};

function grouped(features: FeatureDef[]) {
  const out: { group: string; items: FeatureDef[] }[] = [];
  for (const f of features) {
    let g = out.find((x) => x.group === f.group);
    if (!g) {
      g = { group: f.group, items: [] };
      out.push(g);
    }
    g.items.push(f);
  }
  return out;
}

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "—";
}

export function UsersTab({ canManage }: { canManage: boolean }) {
  const [features, setFeatures] = useState<FeatureDef[]>([]);
  const [roleMaps, setRoleMaps] = useState<Record<string, Record<string, boolean>>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [activeRole, setActiveRole] = useState<"MANAGER" | "USER">("MANAGER");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserFeatureData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/settings/role-features").then((r) => r.json()),
      fetch("/api/v1/users").then((r) => r.json()),
    ])
      .then(([rf, us]) => {
        setFeatures(rf.data?.features ?? []);
        setRoleMaps(rf.data?.roles ?? {});
        setUsers(us.data ?? []);
      })
      .finally(() => setLoaded(true));
  }, []);

  async function toggleRole(role: "MANAGER" | "USER", key: string, value: boolean) {
    setRoleMaps((m) => ({ ...m, [role]: { ...m[role], [key]: value } }));
    const r = await fetch("/api/v1/settings/role-features", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, features: { [key]: value } }),
    });
    setFlash(r.ok ? { ok: true, text: "Rollen-Vorgabe gespeichert." } : { ok: false, text: "Speichern fehlgeschlagen." });
  }

  async function openUser(u: User) {
    if (expanded === u.id) {
      setExpanded(null);
      return;
    }
    setExpanded(u.id);
    setUserData(null);
    const r = await fetch(`/api/v1/users/${u.id}/features`).then((x) => x.json());
    if (r.data) setUserData({ effective: r.data.effective, overrides: r.data.overrides, roleDefault: r.data.roleDefault });
  }

  async function setOverride(userId: string, key: string, value: boolean | null) {
    const r = await fetch(`/api/v1/users/${userId}/features`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overrides: { [key]: value } }),
    });
    const b = await r.json().catch(() => ({}));
    if (r.ok && b.data) {
      setUserData((d) => {
        if (!d) return d;
        const overrides = { ...d.overrides };
        if (value === null) delete overrides[key];
        else overrides[key] = value;
        return { effective: b.data.effective, overrides, roleDefault: d.roleDefault };
      });
      setFlash({ ok: true, text: "Berechtigung gespeichert." });
    } else {
      setFlash({ ok: false, text: "Speichern fehlgeschlagen." });
    }
  }

  if (!loaded) return <div className="text-sm text-muted-foreground">Lädt…</div>;

  const groups = grouped(features);

  return (
    <div className="space-y-6">
      <FlashBanner flash={flash} />

      {/* Rollen-Vorgaben */}
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-foreground">Rollen-Vorgaben</div>
              <div className="text-xs text-muted-foreground">Welche Funktionen eine Rolle standardmäßig sieht.</div>
            </div>
            <div className="inline-flex rounded-lg border border-border p-0.5">
              {(["MANAGER", "USER"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setActiveRole(r)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    activeRole === r ? "bg-navy-900 text-white dark:bg-gold-500 dark:text-navy-900" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.group}>
                <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{g.group}</div>
                <div className="divide-y divide-border rounded-lg border border-border">
                  {g.items.map((f) => {
                    const on = roleMaps[activeRole]?.[f.key] ?? false;
                    return (
                      <label key={f.key} className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm">
                        <span className="text-foreground">{f.label}</span>
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={!canManage}
                          onChange={(e) => toggleRole(activeRole, f.key, e.target.checked)}
                          className="h-4 w-4 accent-navy-900 dark:accent-gold-500"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Benutzer */}
      <Card>
        <CardContent className="space-y-2 pt-5">
          <div className="text-sm font-medium text-foreground">Benutzer dieses Tenants</div>
          <div className="text-xs text-muted-foreground">
            Pro Benutzer einzelne Funktionen abweichend von der Rolle erlauben oder sperren.
          </div>
          <div className="divide-y divide-border rounded-lg border border-border">
            {users.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted-foreground">Keine Benutzer.</div>}
            {users.map((u) => (
              <div key={u.id}>
                <button
                  onClick={() => openUser(u)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{u.name || u.email}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {u.email} · {ROLE_LABEL[u.role] ?? u.role} · zuletzt {fmt(u.lastLoginAt)}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{expanded === u.id ? "▲" : "▼"}</span>
                </button>

                {expanded === u.id && (
                  <div className="border-t border-border bg-muted/30 px-3 py-3">
                    {u.role === "GLOBAL_ADMIN" ? (
                      <div className="text-sm text-muted-foreground">Globale Admins haben immer alle Funktionen.</div>
                    ) : !userData ? (
                      <div className="text-sm text-muted-foreground">Lädt…</div>
                    ) : (
                      <div className="space-y-4">
                        {groups.map((g) => (
                          <div key={g.group}>
                            <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{g.group}</div>
                            <div className="divide-y divide-border rounded-lg border border-border bg-card">
                              {g.items.map((f) => {
                                const ovr = userData.overrides[f.key]; // true | false | undefined
                                const state: "inherit" | "on" | "off" = ovr === undefined ? "inherit" : ovr ? "on" : "off";
                                const roleHas = userData.roleDefault[f.key];
                                return (
                                  <div key={f.key} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                                    <span className="text-foreground">
                                      {f.label}
                                      <span className="ml-2 text-[10px] text-muted-foreground">
                                        Rolle: {roleHas ? "erlaubt" : "gesperrt"}
                                      </span>
                                    </span>
                                    <div className="inline-flex shrink-0 rounded-md border border-border">
                                      {([
                                        ["inherit", "Rolle", null],
                                        ["on", "Erlaubt", true],
                                        ["off", "Gesperrt", false],
                                      ] as const).map(([s, lbl, val]) => (
                                        <button
                                          key={s}
                                          disabled={!canManage}
                                          onClick={() => setOverride(u.id, f.key, val)}
                                          className={cn(
                                            "px-2 py-1 text-xs transition-colors first:rounded-l-md last:rounded-r-md",
                                            state === s
                                              ? "bg-navy-900 text-white dark:bg-gold-500 dark:text-navy-900"
                                              : "text-muted-foreground hover:text-foreground",
                                          )}
                                        >
                                          {lbl}
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
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
