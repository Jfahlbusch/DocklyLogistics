"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";
import { openSearch } from "@/components/search/open-search";
import { ProfileMenu } from "./profile-menu";
import { NotificationBell } from "./notification-bell";

export function Topbar({
  user,
}: {
  user: { name: string; email?: string; role: string; tenant: string };
}) {
  const pathname = usePathname();
  const current = NAV_ITEMS.find((n) => pathname.startsWith(n.href));
  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background/85 px-4 shadow-sm backdrop-blur lg:px-6">
      <div className="text-sm text-muted-foreground">
        <span className="text-muted-foreground/50">DocklyLogistics</span>
        <span className="mx-2 text-muted-foreground/40">/</span>
        <b className="font-medium text-foreground">{current?.label ?? "Übersicht"}</b>
      </div>
      <div className="flex-1" />
      <button
        type="button"
        onClick={openSearch}
        aria-label="Globale Suche öffnen"
        className="hidden w-60 items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground md:flex"
      >
        <Search size={14} strokeWidth={1.5} />
        <span className="flex-1 text-left">Suchen…</span>
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>
      <NotificationBell />
      <ProfileMenu user={user} />
    </header>
  );
}
