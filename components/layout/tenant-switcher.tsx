"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Search, TriangleAlert } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { initials } from "@/lib/user-display";
import { cn } from "@/lib/utils";

export type TenantSwitcherData = {
  /** Wirksamer Mandant (bei Fremdansicht der betrachtete). */
  currentTenant: string;
  /** Echter Mandant des angemeldeten GLOBAL_ADMIN. */
  homeTenant: string;
  tenants: { id: string; name: string }[];
};

type Props = TenantSwitcherData & {
  /** Sidebar eingeklappt: nur Initialen-Kachel, Popover öffnet seitlich. */
  collapsed?: boolean;
};

const ENDPOINT = "/api/v1/me/tenant-view";
const TARGET_AFTER_SWITCH = "/dashboard";

/**
 * Mandanten-Wechsler für GLOBAL_ADMIN (Sidebar + mobiler Drawer, direkt unter dem Brand).
 * Wechsel = PUT/DELETE auf /api/v1/me/tenant-view, danach genau EINE volle Navigation —
 * bewusst kein router.push/refresh, sonst überlebt der Client-Cache des alten Mandanten.
 * Bei Fremdansicht ist der Auslöser selbst warnfarben getönt (sichtbar ohne Popover).
 */
export function TenantSwitcher({ currentTenant, homeTenant, tenants, collapsed }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const nameOf = (id: string) => tenants.find((t) => t.id === id)?.name ?? id;
  const foreign = currentTenant !== homeTenant;
  const currentName = nameOf(currentTenant);

  // bfcache: Zurück-Navigation stellt die Seite im „leaving“-Zustand wieder her.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setLeaving(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q));
  }, [tenants, query]);

  async function run(request: () => Promise<Response>) {
    if (leaving) return;
    setError(null);
    setLeaving(true);
    try {
      const res = await request();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      window.location.assign(TARGET_AFTER_SWITCH);
    } catch {
      setLeaving(false);
      setError("Wechsel fehlgeschlagen. Bitte erneut versuchen.");
    }
  }

  const backToHome = () => run(() => fetch(ENDPOINT, { method: "DELETE" }));

  function choose(id: string) {
    if (id === currentTenant) {
      setOpen(false);
      return;
    }
    // Zurück in den eigenen Mandanten = Ansicht beenden (DELETE), nicht „fremd“ auf sich selbst setzen.
    if (id === homeTenant) return void backToHome();
    void run(() =>
      fetch(ENDPOINT, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId: id }),
      }),
    );
  }

  return (
    <div className={cn(collapsed ? "px-2 pt-3" : "px-3 pt-3.5")}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setQuery("");
            setError(null);
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={leaving}
            aria-busy={leaving}
            aria-label={`Mandant wechseln: ${currentName}`}
            title={collapsed ? currentName : undefined}
            data-foreign={foreign ? "true" : undefined}
            className={cn(
              "flex w-full items-center rounded-md text-left text-sm text-white/80 outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-wait",
              collapsed ? "justify-center p-1" : "gap-2.5 px-2 py-1.5",
              foreign &&
                "bg-[color-mix(in_srgb,var(--color-warning)_22%,transparent)] text-white ring-1 ring-[color-mix(in_srgb,var(--color-warning)_55%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-warning)_32%,transparent)]",
            )}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 text-[11px] font-medium text-white">
              {leaving && collapsed ? <Loader2 size={14} className="animate-spin" aria-hidden /> : initials(currentName)}
            </span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 truncate">{currentName}</span>
                {leaving ? (
                  <Loader2 size={14} className="shrink-0 animate-spin text-white/70" aria-hidden />
                ) : (
                  <ChevronsUpDown size={14} strokeWidth={1.5} className="shrink-0 text-white/60" aria-hidden />
                )}
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side={collapsed ? "right" : "bottom"}
          align="start"
          className="w-[min(20rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0"
          onOpenAutoFocus={(e) => {
            // Das Suchfeld soll den Fokus bekommen, nicht das erste Element im Popover.
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          {foreign && (
            <div
              role="status"
              className="flex flex-col gap-2 border-b border-border bg-[color-mix(in_srgb,var(--color-warning)_15%,transparent)] p-3 text-xs"
            >
              <div className="flex items-start gap-2">
                <TriangleAlert size={14} className="mt-0.5 shrink-0 text-warning" aria-hidden />
                <span>
                  Sie betrachten den Mandanten <b className="font-medium">{currentName}</b>. Änderungen wirken
                  dort wie bei einem echten Nutzer.
                </span>
              </div>
              <button
                type="button"
                onClick={() => void backToHome()}
                disabled={leaving}
                className="self-start rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
              >
                Zurück zum eigenen Mandanten
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search size={14} strokeWidth={1.5} className="shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches[0]) {
                  e.preventDefault();
                  choose(matches[0].id);
                }
              }}
              placeholder="Mandant suchen…"
              aria-label="Mandant suchen"
              autoComplete="off"
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <ul className="max-h-64 overflow-y-auto p-1">
            {matches.length === 0 && <li className="px-2 py-3 text-center text-sm text-muted-foreground">Kein Treffer</li>}
            {matches.map((t) => {
              const isCurrent = t.id === currentTenant;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => choose(t.id)}
                    disabled={leaving}
                    aria-current={isCurrent ? "true" : undefined}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                      {isCurrent && <Check size={14} strokeWidth={2} aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    {t.id === homeTenant && (
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        eigener
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {error && (
            <p role="alert" className="border-t border-border bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
