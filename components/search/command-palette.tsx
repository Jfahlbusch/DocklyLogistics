"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, CornerDownLeft, Loader2, Package, Truck, ShoppingCart, type LucideIcon } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { useGlobalSearch } from "@/lib/search/use-global-search";
import { SEARCH_OPEN_EVENT } from "./open-search";
import { cn } from "@/lib/utils";

type Entry = {
  key: string;
  href: string;
  label: string;
  sub?: string;
  group: string;
  icon: LucideIcon;
};

const GROUP_ICON: Record<string, LucideIcon> = {
  articles: Package,
  suppliers: Truck,
  orders: ShoppingCart,
};

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { groups, isFetching, enabled } = useGlobalSearch(query);

  // ── Open mechanisms: ⌘K / Ctrl+K + the app:search:open custom event ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(SEARCH_OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(SEARCH_OPEN_EVENT, onOpen);
    };
  }, []);

  // Reset + focus when opening.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // focus after the dialog paints
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ── Build the flat, ordered entry list: navigation targets + content hits ──
  const entries = useMemo<Entry[]>(() => {
    const trimmed = query.trim().toLowerCase();
    const nav: Entry[] = NAV_ITEMS.filter(
      (n) => !trimmed || n.label.toLowerCase().includes(trimmed),
    ).map((n) => ({
      key: `nav:${n.id}`,
      href: n.href,
      label: n.label,
      group: "Navigation",
      icon: n.icon,
    }));

    const content: Entry[] = groups.flatMap((g) =>
      g.items.map((it) => ({
        key: `${g.key}:${it.id}`,
        href: it.href,
        label: it.title,
        sub: it.subtitle,
        group: g.label,
        icon: GROUP_ICON[g.key] ?? Search,
      })),
    );

    return [...nav, ...content];
  }, [query, groups]);

  // Clamp active index whenever the list changes.
  useEffect(() => {
    setActiveIndex((i) => Math.min(Math.max(i, 0), Math.max(entries.length - 1, 0)));
  }, [entries.length]);

  // Scroll active row into view.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const close = useCallback(() => setOpen(false), []);

  const select = useCallback(
    (entry: Entry | undefined) => {
      if (!entry) return;
      setOpen(false);
      router.push(entry.href);
    },
    [router],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (entries.length ? (i + 1) % entries.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (entries.length ? (i - 1 + entries.length) % entries.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(entries[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  if (!open) return null;

  const showTypeMore = query.trim().length === 1;
  const showEmpty = enabled && !isFetching && entries.length === 0;

  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm px-4 pt-[12vh]"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Globale Suche"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4">
          {isFetching ? (
            <Loader2 size={18} strokeWidth={1.5} className="shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Search size={18} strokeWidth={1.5} className="shrink-0 text-muted-foreground" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Suchen: Artikel, Lieferanten, Bestellungen oder Seite…"
            aria-label="Suchbegriff"
            className="h-12 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
          {entries.map((entry, index) => {
            const header = entry.group !== lastGroup ? entry.group : null;
            lastGroup = entry.group;
            const isActive = index === activeIndex;
            const isCurrent = entry.href === pathname;
            const Icon = entry.icon;
            return (
              <div key={entry.key}>
                {header && (
                  <div className="px-2 pb-1 pt-3 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground first:pt-1">
                    {header}
                  </div>
                )}
                <button
                  type="button"
                  data-index={index}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => select(entry)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors",
                    isActive ? "bg-accent/15 text-foreground" : "text-foreground hover:bg-muted",
                  )}
                >
                  <Icon
                    size={16}
                    strokeWidth={1.5}
                    className={cn("shrink-0", isActive ? "text-accent" : "text-muted-foreground")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{entry.label}</span>
                    {entry.sub && (
                      <span className="block truncate text-xs text-muted-foreground">{entry.sub}</span>
                    )}
                  </span>
                  {isCurrent && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">aktuell</span>
                  )}
                  {isActive && (
                    <CornerDownLeft size={14} strokeWidth={1.5} className="shrink-0 text-muted-foreground" />
                  )}
                </button>
              </div>
            );
          })}

          {showTypeMore && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              Mindestens 2 Zeichen eingeben…
            </div>
          )}
          {showEmpty && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              Keine Treffer für „{query.trim()}“.
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-2">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5">↑</kbd>
            <kbd className="rounded border border-border bg-muted px-1 py-0.5">↓</kbd>
            navigieren
            <kbd className="rounded border border-border bg-muted px-1 py-0.5">↵</kbd>
            öffnen
          </span>
          <span>{isFetching ? "Suche läuft…" : "Globale Suche"}</span>
        </div>
      </div>
    </div>
  );
}
