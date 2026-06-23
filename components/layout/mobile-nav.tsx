"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { SidebarUser } from "./sidebar-user";

/** Hamburger + full-screen off-canvas drawer that replaces the sidebar below md. */
export function MobileNav({
  user,
  allowedNav,
}: {
  user: { name: string; role: string; tenant: string };
  allowedNav?: string[];
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

        {/* Logo centered with generous clear space (Schutzraum) */}
        <div className="flex items-center justify-center border-b border-white/10 px-8 py-7">
          <Logo variant="dark" />
        </div>

        {/* Close — placed at the menu items, not at the logo */}
        <div className="flex justify-end px-4 pt-3">
          <button
            type="button"
            onClick={close}
            aria-label="Menü schließen"
            className="rounded-md p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={26} strokeWidth={1.5} />
          </button>
        </div>

        <NavLinks onNavigate={close} allowedNav={allowedNav} />
        <SidebarUser user={user} />
      </SheetContent>
    </Sheet>
  );
}
