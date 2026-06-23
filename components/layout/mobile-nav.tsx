"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Brand } from "./brand";
import { NavLinks } from "./nav-links";
import { SidebarUser } from "./sidebar-user";

/** Hamburger + off-canvas drawer that replaces the sidebar below the md breakpoint. */
export function MobileNav({ user }: { user: { name: string; role: string; tenant: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Menü öffnen"
          className="-ml-1 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
        >
          <Menu size={22} strokeWidth={1.5} />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="app-sidebar w-[270px] max-w-[80vw] gap-0 border-white/10 p-0 text-white">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <Brand />
        <NavLinks onNavigate={() => setOpen(false)} />
        <SidebarUser user={user} />
      </SheetContent>
    </Sheet>
  );
}
