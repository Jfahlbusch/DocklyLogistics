"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    const r = await fetch("/api/v1/me/notifications");
    if (r.ok) {
      const b = await r.json();
      setItems(b.data.items ?? []);
      setUnread(b.data.unread ?? 0);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAll() {
    await fetch("/api/v1/me/notifications/read", { method: "POST" });
    load();
  }

  async function openNotif(n: Notif) {
    if (!n.readAt) {
      await fetch("/api/v1/me/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      });
    }
    setOpen(false);
    if (n.link) router.push(n.link);
    else load();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        aria-label="Benachrichtigungen"
        aria-expanded={open}
        className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell size={20} strokeWidth={1.5} />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-medium text-foreground">Benachrichtigungen</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-muted-foreground hover:text-foreground">
                Alle als gelesen
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                Keine Benachrichtigungen.
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openNotif(n)}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 border-b border-border px-3 py-2.5 text-left transition-colors hover:bg-muted",
                    !n.readAt && "bg-accent/5",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    {!n.readAt && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                    {n.title}
                  </span>
                  {n.body && <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>}
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
