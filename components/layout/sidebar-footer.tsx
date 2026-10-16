"use client";

import { SidebarUser } from "./sidebar-user";
import type { UserRole } from "@/lib/auth/role";
import { cn } from "@/lib/utils";

type Props = {
  userName: string;
  userEmail: string;
  role: UserRole;
  subtitle?: string;
  collapsed?: boolean;
};

/**
 * Fuß des Menüs (Portal: `.sidebar-footer`): bleibt unten, Trennlinie oben, Innenabstand 14,4 × 11,2 px (eingeklappt 14,4 × 12 px),
 * untere Ecken folgen dem Radius der Leiste. Auf niedrigen Displays (≤ 900 px) 8 px, im Querformat-Handy (≤ 400 px) kein senkrechter Rand.
 * Den Einklapp-Knopf trägt, wie im Portal, die Kante der Leiste selbst (`sidebar.tsx`), nicht der Fuß.
 */
export function SidebarFooter({ userName, userEmail, role, subtitle, collapsed = false }: Props) {
  return (
    <div className={cn("mt-auto shrink-0 rounded-b-[inherit] border-t border-sidebar-border py-[0.9rem] short:py-2 tiny:py-0", collapsed ? "px-3" : "px-[0.7rem]")}>
      <SidebarUser userName={userName} userEmail={userEmail} role={role} subtitle={subtitle} collapsed={collapsed} />
    </div>
  );
}
