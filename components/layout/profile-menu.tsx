"use client";

import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/user-display";
import { ProfileMenuContent, type ProfilUser } from "./profile-menu-content";

/** Topbar-Auslöser des Profilmenüs: runder Avatar nur mit Initialen, Menü öffnet nach unten. */
export function ProfileMenu({ user }: { user: ProfilUser }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Profil & Einstellungen"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:h-8 md:w-8 dark:bg-gold-500 dark:text-navy-900"
      >
        {initials(user.name)}
      </DropdownMenuTrigger>
      <ProfileMenuContent user={user} side="bottom" align="end" />
    </DropdownMenu>
  );
}
