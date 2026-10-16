"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Brand } from "./brand";
import { TenantChip } from "./tenant-chip";
import { TenantSwitcher, type TenantSwitcherData } from "./tenant-switcher";
import { NavLinks } from "./nav-links";
import { SidebarProfile } from "./sidebar-profile";
import type { ProfilUser } from "./profile-menu-content";

/** Hamburger + full-screen off-canvas drawer below md; spiegelt die Sidebar (Brand, Mandant, Gruppen, Profil-Fuß). */
export function MobileNav({
  user,
  allowedNav,
  tenantSwitcher,
}: {
  user: ProfilUser;
  allowedNav?: string[];
  tenantSwitcher?: TenantSwitcherData | null;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Menü öffnen"
          className="-ml-1 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
        >
          <Menu size={24} strokeWidth={1.5} />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="app-sidebar !w-full !max-w-full gap-0 border-white/10 p-0 text-white"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>

        {/* Menü-Anatomie wie die Sidebar: Brand → Mandant → Gruppen → Profil; Schließen oben rechts */}
        <div className="relative">
          <Brand />
          <button
            type="button"
            onClick={close}
            aria-label="Menü schließen"
            className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={26} strokeWidth={1.5} />
          </button>
        </div>
        {tenantSwitcher ? <TenantSwitcher {...tenantSwitcher} /> : <TenantChip tenant={user.tenant} />}

        <NavLinks onNavigate={close} allowedNav={allowedNav} />
        <SidebarProfile user={user} />
      </SheetContent>
    </Sheet>
  );
}
