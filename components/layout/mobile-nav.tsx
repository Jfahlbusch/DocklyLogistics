"use client";

import type { TenantNavigation } from "@/lib/schemas/tenant-view";

import { useState } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { TenantSwitcher } from "./tenant-switcher";
import { Brand } from "./brand";
import { NavLinks } from "./nav-links";
import { SidebarFooter } from "./sidebar-footer";
import { SIDEBAR_SHELL_CLASS } from "@/lib/sidebar-geometry";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/auth/role";

type Props = {
  role: UserRole;
  allowed?: readonly string[];
  userName: string;
  userEmail: string;
  tenantNavigation?: TenantNavigation;
};

/**
 * Burger-Trigger + Drawer, ersetzt die Sidebar unterhalb 992 px (Portal-Breakpoint `lg`). Der Drawer ist dieselbe schwebende Leiste wie am
 * Desktop (Portal: `.sidebar` unter `lg` mit `transform`): 268 px breit (höchstens Display − 24 px), 12 px vom Rand, Höhe Display − 24 px,
 * Radius 26 px, Rand 1 px und Schatten, mit Marke, Unternehmen, Bereichen und Profilzeile; ohne Einklapp-Knopf (nur ab 992 px).
 */
export function MobileNav({ role, allowed, userName, userEmail, tenantNavigation }: Props) {
  const t = useTranslations("shell");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={t("openMenu")}
          className="-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring nav:hidden"
        >
          <Menu size={24} strokeWidth={1.5} aria-hidden />
        </button>
      </SheetTrigger>
      {/* Ohne SheetDescription: `aria-describedby={undefined}` ist der dokumentierte
          Radix-Opt-out, sonst verweist der Drawer auf eine fehlende Beschreibungs-ID. */}
      <SheetContent
        side="left"
        aria-describedby={undefined}
        // Unser shadcn-Sheet setzt die Seitenmaße über `data-[side=left]:*` (höhere Spezifität) — darum dieselbe Variante,
        // damit tailwind-merge die Vorgaben ersetzt statt sie zu überlagern.
        className={cn("gap-0 overflow-visible data-[side=left]:inset-y-auto data-[side=left]:top-3 data-[side=left]:left-3 data-[side=left]:h-[calc(100dvh-1.5rem)] data-[side=left]:w-[268px] data-[side=left]:max-w-[calc(100vw-1.5rem)] data-[side=left]:border data-[side=left]:sm:max-w-[calc(100vw-1.5rem)]", SIDEBAR_SHELL_CLASS)}
      >
        <SheetTitle className="sr-only">{t("navigation")}</SheetTitle>
        <Brand />
        {tenantNavigation && <TenantSwitcher navigation={tenantNavigation} />}
        <NavLinks role={role} allowed={allowed} onNavigate={close} />
        <SidebarFooter userName={userName} userEmail={userEmail} role={role} subtitle={tenantNavigation?.currentName} />
      </SheetContent>
    </Sheet>
  );
}
