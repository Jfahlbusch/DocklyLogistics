"use client";

import { ChevronsUpDown } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { initials, roleLabel } from "@/lib/user-display";
import { cn } from "@/lib/utils";
import { ProfileMenuContent, type ProfilUser } from "./profile-menu-content";

/** Sidebar-Fuß-Auslöser des Profilmenüs (auch im Mobile-Drawer): Avatar + Name + `Rolle · Mandant`;
 *  eingeklappt nur der Avatar. Menü öffnet nach oben. */
export function SidebarProfile({ user, collapsed }: { user: ProfilUser; collapsed?: boolean }) {
  return (
    <div className={cn("border-t border-white/10 py-2", collapsed ? "px-2" : "px-3")}>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Profilmenü"
          title={collapsed ? `${user.name} · ${roleLabel(user.role)} · ${user.tenant}` : undefined}
          className={cn(
            "flex w-full items-center rounded-lg text-left text-white outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/40 data-[state=open]:bg-white/5",
            collapsed ? "justify-center p-1.5" : "gap-3 px-2 py-2",
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white">
            {initials(user.name)}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-white">{user.name}</span>
                <span className="block truncate text-xs text-white/50">
                  {roleLabel(user.role)} · {user.tenant}
                </span>
              </span>
              <ChevronsUpDown size={16} strokeWidth={1.5} className="shrink-0 text-white/50" />
            </>
          )}
        </DropdownMenuTrigger>
        <ProfileMenuContent user={user} side="top" align="start" />
      </DropdownMenu>
    </div>
  );
}
