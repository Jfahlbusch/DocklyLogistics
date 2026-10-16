"use client";

import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { TenantNavigation } from "@/lib/schemas/tenant-view";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { TenantCardBody, tenantCardClass } from "./tenant-card";

const PAGE_SIZE = 3;
/** Ziel nach dem Wechsel: eine volle Navigation (kein router.push), damit kein Client-Cache des alten Mandanten überlebt. */
const TARGET_AFTER_SWITCH = "/dashboard";

/**
 * Server liefert fremde Namen nur für GLOBAL_ADMIN; normal bleibt die Unternehmensanzeige. Wechsel = PUT/DELETE auf
 * `/api/v1/me/tenant-view` (gehärtete Route, Audit im Ziel-Mandanten). Abweichung von der Vorlage: kein `ErrorNotice`/`useErrorText`
 * (gibt es im Projekt nicht) — ein Fehler zeigt einen Hinweis mit „Erneut versuchen“.
 */
export function TenantSwitcher({ navigation, collapsed }: { navigation: TenantNavigation; collapsed?: boolean }) {
  const t = useTranslations("shell.tenantSwitcher");
  const locale = useLocale();
  const shortDisplay = useMediaQuery("(max-height: 700px)");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(false);
  const isForeign = navigation.currentTenant !== navigation.homeTenant;
  const options = navigation.tenants?.filter(({ id, name }) => `${name} ${id}`.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale))) ?? [];
  const pages = Math.max(1, Math.ceil(options.length / PAGE_SIZE));

  useEffect(() => {
    // Eine aus dem Back/Forward-Cache restaurierte Shell darf nicht gesperrt bleiben.
    const restore = () => setBusy(false);
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  async function change(tenantId?: string) {
    if (busy) return;
    setBusy(true);
    setFailure(false);
    try {
      const response = await fetch("/api/v1/me/tenant-view", {
        method: tenantId ? "PUT" : "DELETE",
        ...(tenantId ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId }) } : {}),
      });
      if (!response.ok) {
        setFailure(true);
        setBusy(false);
        return;
      }
      // Vollständiger neuer Render: keine alten Artikel-IDs oder RSC-Daten des vorigen Unternehmens.
      window.location.assign(TARGET_AFTER_SWITCH);
    } catch {
      setFailure(true);
      setBusy(false);
    }
  }

  // Portal: `px-2 my-3` um die Karte; auf niedrigen Displays enger (Bereiche sollen offen bleiben).
  const wrapper = "shrink-0 px-2 my-3 short:my-2 max-nav:short:my-1.5 tiny:my-0";
  if (!navigation.tenants) {
    // Ohne Wechselrecht eine statische Anzeige des eigenen Unternehmens (Portal: `.tenant-current` mit `cursor: default`).
    return (
      <div className={wrapper}>
        <div className={cn(tenantCardClass({ collapsed }), "cursor-default")} title={navigation.currentName} aria-label={t("summary", { name: navigation.currentName })}>
          <TenantCardBody name={navigation.currentName} collapsed={collapsed} />
        </div>
      </div>
    );
  }
  return (
    <div className={cn("relative", wrapper)}>
      <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) { setQuery(""); setPage(0); setFailure(false); } }}>
        {(collapsed || shortDisplay) && <PopoverAnchor asChild><span aria-hidden className="pointer-events-none absolute inset-x-2 top-0 h-11" /></PopoverAnchor>}
        <PopoverTrigger asChild>
          <button type="button" aria-label={t("label")} title={navigation.currentName} disabled={busy} className={tenantCardClass({ collapsed, foreign: isForeign, interactive: true })}>
            <TenantCardBody name={navigation.currentName} collapsed={collapsed} open={open} withChevron />
          </button>
        </PopoverTrigger>
        <PopoverContent side={collapsed || shortDisplay ? "right" : "bottom"} align="start" className="w-72 max-w-[calc(100vw-1rem)] p-2" aria-label={t("label")} aria-busy={busy}>
          {busy ? <p role="status" className="p-3 text-sm">{t("working")}</p> : failure ? <div role="alert" className="p-2 text-sm">
            <p>{t("failed")}</p>
            <button type="button" onClick={() => setFailure(false)} className="mt-1 min-h-11 font-medium underline underline-offset-4">{t("retry")}</button>
          </div> : <>
            {isForeign && <div className="mb-1 rounded-md bg-muted px-2">
              <p className="truncate pt-2 text-xs">{t("viewing", { name: navigation.currentName })}</p>
              <button type="button" onClick={() => void change()} className="min-h-11 text-left text-sm font-medium underline underline-offset-4">{t("reset")}</button>
            </div>}
            <Input aria-label={t("search")} placeholder={t("search")} value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} className="mb-1 min-h-11 text-base" />
            <div role="group" aria-label={t("current")}>
              {options.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(({ id, name }) => <button type="button" key={id} aria-pressed={id === navigation.currentTenant}
                onClick={() => { if (id !== navigation.currentTenant) void change(id); else setOpen(false); }}
                className={cn("flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-muted", id === navigation.currentTenant && "bg-muted")}>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{name}</span><span className="block truncate text-xs text-muted-foreground">{id}{id === navigation.homeTenant && ` · ${t("home")}`}</span></span>
                {id === navigation.currentTenant && <Check size={18} aria-hidden />}
              </button>)}
              {!options.length && <p role="status" className="p-2 text-sm text-muted-foreground">{t("empty")}</p>}
            </div>
            {pages > 1 && <div className="mt-1 flex items-center justify-between gap-2">
              <Button type="button" variant="ghost" size="icon" aria-label={t("previous")} disabled={page === 0} onClick={() => setPage(value => value - 1)}><ChevronLeft aria-hidden /></Button>
              <span className="text-xs text-muted-foreground">{t("page", { page: page + 1, pages })}</span>
              <Button type="button" variant="ghost" size="icon" aria-label={t("next")} disabled={page + 1 >= pages} onClick={() => setPage(value => value + 1)}><ChevronRight aria-hidden /></Button>
            </div>}
          </>}
        </PopoverContent>
      </Popover>
    </div>
  );
}
