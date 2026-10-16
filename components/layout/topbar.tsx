"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { findActiveEntry } from "@/lib/navigation";
import type { UserRole } from "@/lib/auth/role";
import type { TenantNavigation } from "@/lib/schemas/tenant-view";
import { openSearch } from "@/components/search/open-search";
import { ThemeMenuButton } from "@/components/theme/theme-toggle";
import { NotificationBell } from "./notification-bell";
import { MobileNav } from "./mobile-nav";

type Props = {
  role: UserRole;
  allowed?: readonly string[];
  userName: string;
  userEmail: string;
  /** Wird nur an den Drawer durchgereicht — die Kopfleiste selbst zeigt das Unternehmen nicht. */
  tenantNavigation?: TenantNavigation;
};

/**
 * Kopfleiste (`seitenmenue.md` §3/§4): unter 992 px links der Burger (Drawer), Brotkrume, ⌘K-Suche, unter 992 px der
 * Farbschema-Knopf (der Menüfuß im Drawer hat dann keinen), ganz rechts die Glocke. Kein Profil-Avatar — Profil, Farbschema
 * und Abmelden sitzen in der Profilzeile am Fuß des Menüs.
 */
export function Topbar({ role, allowed, userName, userEmail, tenantNavigation }: Props) {
  const t = useTranslations();
  const pathname = usePathname();
  const current = findActiveEntry(pathname);
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur sm:gap-4 md:px-8">
      <MobileNav role={role} allowed={allowed} userName={userName} userEmail={userEmail} tenantNavigation={tenantNavigation} />
      <nav aria-label={t("shell.topbar.breadcrumb")} className="min-w-0 truncate text-sm text-muted-foreground">
        <span className="hidden text-muted-foreground/70 sm:inline">{t("common.appName")}</span>
        <span aria-hidden className="mx-2 hidden text-muted-foreground/50 sm:inline">/</span>
        <b className="font-medium text-foreground">{t(current?.labelKey ?? "nav.areas.overview")}</b>
      </nav>
      <div className="flex-1" />
      <button
        type="button"
        onClick={openSearch}
        aria-label={t("shell.topbar.openGlobalSearch")}
        className="hidden w-60 items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground md:flex"
      >
        <Search size={14} strokeWidth={1.5} aria-hidden />
        <span className="flex-1 text-left">{t("shell.topbar.searchPlaceholder")}</span>
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">⌘K</kbd>
      </button>
      <button
        type="button"
        onClick={openSearch}
        aria-label={t("shell.topbar.openSearch")}
        className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
      >
        <Search size={20} strokeWidth={1.5} aria-hidden />
      </button>
      <ThemeMenuButton className="nav:hidden" />
      <NotificationBell />
    </header>
  );
}
