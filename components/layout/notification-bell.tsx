"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { safeInternalLink } from "@/lib/safe-internal-link";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  /** Lesezeitpunkt des angemeldeten Nutzers; null = ungelesen. */
  readAt: string | null;
  createdAt: string;
};

const API = "/api/v1/me/notifications";
const POLL_MS = 60_000;



async function postRead(id?: string): Promise<boolean> {
  try {
    const r = await fetch(`${API}/read`, {
      method: "POST",
      ...(id ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) } : {}),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Glocke in der Topbar: Meldungen des Mandanten, Lesestatus je Nutzer.
 * Aktualisiert beim Mount, bei jedem Öffnen, nach „Alle als gelesen", beim
 * Sichtbar-/Fokuswerden des Tabs und alle 60 s, solange der Tab sichtbar ist.
 */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  // Nur die jüngste Antwort gilt — überholte (langsame) Abrufe dürfen den Stand nicht zurücksetzen.
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const r = await fetch(API);
      if (!r.ok || seq !== requestSeq.current) return;
      const b = await r.json();
      if (seq !== requestSeq.current) return;
      setItems(b.data.items ?? []);
      setUnread(b.data.unread ?? 0);
    } catch {
      // Offline/Serverfehler: letzten Stand stehen lassen, nächster Takt versucht es erneut.
    }
  }, []);

  useEffect(() => {
    load();

    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const start = () => {
      stop();
      timer = setInterval(load, POLL_MS);
    };
    const visible = () => document.visibilityState === "visible";

    function onVisibility() {
      if (visible()) {
        load();
        start();
      } else {
        stop();
      }
    }
    function onFocus() {
      load();
    }

    if (visible()) start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) load();
  }

  async function markAll() {
    await postRead();
    await load();
  }

  async function activate(n: Notif) {
    if (!n.readAt) {
      await postRead(n.id);
      // Badge sofort nachziehen (die Topbar bleibt bei Client-Navigation bestehen).
      setItems((cur) => cur.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    const href = safeInternalLink(n.link, window.location.origin);
    if (href) router.push(href);
    load(); // ohne Link bleibt die Seite stehen und zeigt den neuen Stand
  }

  const label = unread > 0 ? `Benachrichtigungen, ${unread} ungelesen` : "Benachrichtigungen";

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        aria-label={label}
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:h-9 md:w-9"
      >
        <Bell size={20} strokeWidth={1.5} aria-hidden />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-80 max-w-[calc(100vw-1rem)] overflow-hidden p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <DropdownMenuLabel className="p-0 text-sm font-medium text-foreground">Benachrichtigungen</DropdownMenuLabel>
          {unread > 0 && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault(); // Panel bleibt offen, die Liste aktualisiert sich
                void markAll();
              }}
              className="w-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Alle als gelesen
            </DropdownMenuItem>
          )}
        </div>

        <div className="max-h-[60dvh] overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Keine Benachrichtigungen</p>
          ) : (
            items.map((n) => (
              <DropdownMenuItem
                key={n.id}
                onSelect={(e) => {
                  e.preventDefault(); // erst quittieren, dann schließen
                  void activate(n);
                }}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 rounded-none border-b border-border px-3 py-2.5 text-left last:border-b-0",
                  !n.readAt && "bg-accent/5",
                )}
              >
                <span className="flex items-center gap-2 text-sm text-foreground">
                  {!n.readAt && (
                    <>
                      <span data-unread-dot aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      <span className="sr-only">Ungelesen:</span>
                    </>
                  )}
                  {n.title}
                </span>
                {n.body && <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>}
                <time dateTime={n.createdAt} className="text-[10px] text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                </time>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
