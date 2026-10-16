"use client";

import { useRef } from "react";
import { CircleUser, LogOut, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { SIDEBAR_ACTION_CLASS, SIDEBAR_ACTION_ICON_PX } from "./sidebar-action";
import { SidebarThemeAction } from "./sidebar-theme-action";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { logoutAction } from "./profile-actions";
import { clearServiceWorkerCaches } from "@/lib/offline-cache";
import type { UserRole } from "@/lib/auth/role";
import { cn } from "@/lib/utils";

type Props = {
  userName: string;
  userEmail: string;
  role?: UserRole;
  /** Untertitel unter dem Namen, in der Regel das aktuelle Unternehmen; ohne Angabe die E-Mail-Adresse. */
  subtitle?: string;
  collapsed?: boolean;
};

/**
 * Profilzeile am Fuß des Menüs (Portal: `.sidebar-user` in `_sidebar_footer.html.erb`): Benutzer-Symbol 25,6 px, Name (16 px / 600) mit
 * Unternehmen (12,8 px, gedämpft) darunter, am Ende die Symbolknöpfe Farbschema, Benutzermenü und Abmelden. Eingeklappt
 * (Rail) bleiben nur die Symbolknöpfe, untereinander mit 4 px Abstand.
 */
export function SidebarUser({ userName, userEmail, role, subtitle, collapsed }: Props) {
  const t = useTranslations("shell");
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <div className={cn("flex min-w-0 items-center gap-[0.6rem] text-sidebar-foreground", collapsed ? "justify-center" : "ps-[0.55rem]")}>
      {!collapsed && <CircleUser size={26} strokeWidth={1.25} aria-hidden className="shrink-0 text-sidebar-foreground/70" />}
      {!collapsed && (
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-base font-semibold">{userName}</span>
          <span className="truncate text-[0.8rem] text-sidebar-foreground/70">{subtitle || userEmail}</span>
        </span>
      )}
      <span className={cn("flex shrink-0 items-center", collapsed && "flex-col gap-1")}>
        <SidebarThemeAction collapsed={collapsed} />
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label={t("user.openMenu")} title={t("user.openMenu")} className={SIDEBAR_ACTION_CLASS}>
              <Settings size={SIDEBAR_ACTION_ICON_PX} strokeWidth={1.5} aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent side={collapsed ? "right" : "top"} align="end" className="app-sidebar w-64 max-w-[calc(100vw-1rem)] p-3 text-sidebar-foreground" aria-label={t("user.openMenu")}>
            <div className="truncate text-sm font-medium">{userName}</div>
            <div className="truncate text-xs text-sidebar-foreground/70">{userEmail}</div>
            {role && <span className="mt-1.5 inline-block rounded-[3px] bg-gold-400/15 px-[5px] text-xs font-bold uppercase leading-4 tracking-[0.3px] text-gold-400">{t(`user.roles.${role}`)}</span>}
            {/* Kein Sprachumschalter: Mehrsprachigkeit vorerst gestrichen (PLAN.md N8, Nutzerentscheidung 16.10.2026). */}
          </PopoverContent>
        </Popover>
        {/* Vor dem Abmelden die Service-Worker-Caches leeren, damit keine Mandantendaten im Gerät bleiben. */}
        <form ref={formRef} action={logoutAction}>
          <button type="submit" onClick={async (event) => { event.preventDefault(); await clearServiceWorkerCaches(); formRef.current?.requestSubmit(); }} aria-label={t("signOut")} title={t("signOut")} className={SIDEBAR_ACTION_CLASS}>
            <LogOut size={SIDEBAR_ACTION_ICON_PX} strokeWidth={1.5} aria-hidden />
          </button>
        </form>
      </span>
    </div>
  );
}
