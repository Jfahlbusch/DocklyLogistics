"use client";

import type { TenantNavigation } from "@/lib/schemas/tenant-view";

import { useEffect, useState } from "react";
import { TenantSwitcher } from "./tenant-switcher";
import { Brand } from "./brand";
import { NavLinks } from "./nav-links";
import { SidebarFooter } from "./sidebar-footer";
import { SidebarToggle } from "./sidebar-toggle";
import type { UserRole } from "@/lib/auth/role";
import { cn } from "@/lib/utils";
import { SIDEBAR_SHELL_CLASS, sidebarSpacePx } from "@/lib/sidebar-geometry";
import { readLegacySidebarPreference, SIDEBAR_COLLAPSED_PX, SIDEBAR_EXPANDED_PX, writeSidebarPreference } from "@/lib/sidebar-preference";

type Props = {
  role: UserRole;
  /** Erlaubte Eintrags-IDs aus den Feature-Rechten (`app/(app)/layout.tsx`). */
  allowed?: readonly string[];
  userName: string;
  userEmail: string;
  tenantNavigation?: TenantNavigation;
  initialCollapsed: boolean;
  hasPreference: boolean;
};

export function Sidebar({ role, allowed, userName, userEmail, initialCollapsed, hasPreference, tenantNavigation }: Props) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!hasPreference) {
      const legacy = readLegacySidebarPreference();
      if (legacy !== undefined) {
        setCollapsed(legacy);
        writeSidebarPreference(legacy);
      }
    }
    // Legacy-State und Entfernen der Vor-Paint-Breite passieren im selben Commit.
    setMounted(true);
  }, [hasPreference]);

  function toggle() {
    const next = !collapsed;
    writeSidebarPreference(next);
    setCollapsed(next);
  }

  // Bis zum ersten Mount gilt die Vor-Paint-Breite aus dem Cookie-Skript (`--app-sidebar-width`), danach der React-State.
  const prePaint = (px: number) => (mounted ? undefined : `calc(var(--app-sidebar-width, ${collapsed ? SIDEBAR_COLLAPSED_PX : SIDEBAR_EXPANDED_PX}px) + ${px}px)`);
  const transition = mounted && "transition-[width] duration-200 motion-reduce:transition-none";

  return (
    <>
      {/* Platzhalter im Seitengefüge (Portal: `.app-main` mit `margin-inline-start: sidebar-w + 2 × gap`): Der Inhalt beginnt rechts neben
          der schwebenden Leiste samt Abstand, auch eingeklappt. Unter 992 px gleitet die Leiste als Drawer herein (mobile-nav.tsx). */}
      <div aria-hidden style={mounted ? undefined : { width: prePaint(sidebarSpacePx(false) - SIDEBAR_EXPANDED_PX) }}
        className={cn("hidden shrink-0 nav:block", transition, collapsed ? "w-[100px]" : "w-[292px]")} />
      {/* Schwebende Leiste: 12 px vom Rand, Höhe = Display − 2 × Abstand, Radius 26 px. Sie wächst nie mit dem Seiteninhalt, bleibt am
          Display (auch am Dokumentende) und scrollt nicht; passen nicht alle Bereiche hinein, öffnet sich der Rest als Popover. */}
      <aside id="app-sidebar" style={mounted ? undefined : { width: `var(--app-sidebar-width, ${collapsed ? SIDEBAR_COLLAPSED_PX : SIDEBAR_EXPANDED_PX}px)` }}
        className={cn(SIDEBAR_SHELL_CLASS, "fixed start-3 top-3 z-40 hidden h-[calc(100dvh-1.5rem)] nav:flex", transition, collapsed ? "w-[76px]" : "w-[268px]")}>
        <SidebarToggle collapsed={collapsed} onToggle={toggle} />
        <Brand collapsed={collapsed} />
        {tenantNavigation && <TenantSwitcher navigation={tenantNavigation} collapsed={collapsed} />}
        <NavLinks role={role} allowed={allowed} collapsed={collapsed} />
        <SidebarFooter userName={userName} userEmail={userEmail} role={role} subtitle={tenantNavigation?.currentName} collapsed={collapsed} />
      </aside>
    </>
  );
}
