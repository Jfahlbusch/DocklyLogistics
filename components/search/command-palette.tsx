"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, CornerDownLeft, Loader2, Package, X, Truck, ShoppingCart, type LucideIcon } from "lucide-react";
import { paletteNavEntries } from "@/lib/navigation";
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

export function CommandPalette({ allowedNav }: { allowedNav?: string[] }) {
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
    const nav: Entry[] = paletteNavEntries(query, allowedNav).map((n) => ({
      key: `nav:${n.id}`,
      href: n.href,
      label: n.label,
      group: n.group,
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
  }, [query, groups, allowedNav]);

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
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm md:px-4 md:pt-[12dvh]"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Globale Suche"
    >
      <div
        className="flex w-full max-w-xl flex-col overflow-hidden border-border bg-popover pt-[env(safe-area-inset-top)] text-popover-foreground shadow-lg max-md:h-dvh max-md:max-w-none md:rounded-xl md:border md:pt-0"
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
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Suchen: Artikel, Lieferanten, Bestellungen oder Seite…"
            aria-label="Suchbegriff"
            className="h-14 min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none md:h-12 md:text-sm [&::-webkit-search-cancel-button]:appearance-none"
          />
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:block">
            ESC
          </kbd>
          <button
            type="button"
            onClick={close}
            aria-label="Schließen"
            className="-mr-3 flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
          >
            <X size={20} strokeWidth={1.5} aria-hidden />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 md:max-h-[60dvh] md:flex-none">
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
                    "flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors",
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
        <div className="hidden items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground md:flex">
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
