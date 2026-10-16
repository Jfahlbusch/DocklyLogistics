"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useScrollingDown } from "@/hooks/use-scroll-direction";
import { openSearch } from "@/components/search/open-search";
import type { UserRole } from "@/lib/auth/role";
import { areaHref, findActiveEntry, visibleAreas } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Symbolgröße der Tabs in px (Lucide `size`). */
export const TAB_ICON_PX = 20;

/**
 * Klassen der Tabs: 44 px Mindestgröße (`min-h-11 min-w-11`), 10 px Innenabstand, 4 px zwischen Symbol und Label. Die Maße gehen in
 * die Breitenrechnung von tests/unit/tab-bar-fit.test.ts ein; wer sie ändert, lässt den Test neu rechnen.
 */
export const TAB_CLASS =
  "flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400 motion-reduce:transition-none";

/**
 * Klassen der Kapsel: 8 px Abstand zwischen den Tabs (L9), 4 px Innenabstand. Unter 400 px Bildschirmbreite rückt sie auf 8 px an den Rand
 * (sonst 16 px), damit das längste Label (DE „Stammdaten“, 73,5 px) bei 360 px samt 8 px Lücke in das Bild passt.
 */
export const TAB_BAR_CLASS =
  "fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-2 min-[400px]:left-4 z-40 flex max-w-[calc(100vw-1rem)] min-[400px]:max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-sidebar-foreground/10 bg-sidebar p-1 text-sidebar-foreground shadow-lg transition-transform duration-200 motion-reduce:transition-none nav:hidden [@media(prefers-reduced-transparency:no-preference)]:bg-sidebar/95 [@media(prefers-reduced-transparency:no-preference)]:backdrop-blur";

/**
 * Schwebende Tab-Pill unterhalb `lg` = 992 px, dem Breakpoint des Portal-Menüs (A8.18): je sichtbarem Bereich ein Tab plus Such-Tab. Beim
 * Herunterscrollen zeigt sie nur noch Icons (`data-minimized`); im Normalzustand trägt nur der aktive
 * Bereich sein Label in der Gold-Kapsel, alle Tabs haben einen übersetzten Namen (`aria-label`). Liegt unter Dialogen und Sheets (`z-50`).
 */
export function TabBar({ role, allowed }: { role: UserRole; allowed?: readonly string[] }) {
  const t = useTranslations();
  const pathname = usePathname();
  const minimized = useScrollingDown();
  const activeArea = findActiveEntry(pathname)?.area ?? "overview";

  return (
    <nav
      aria-label={t("shell.tabBar.label")}
      data-minimized={minimized ? "true" : "false"}
      className={TAB_BAR_CLASS}
    >
      {visibleAreas(role, undefined, allowed).map((area) => {
        const href = areaHref(area.id, role, undefined, allowed);
        if (!href) return null;
        const Icon = area.icon;
        const label = t(area.labelKey);
        // Kurzform nur für das sichtbare Label der Kapsel (8 px Abstand, 343 px nutzbar bei 375 px); der zugängliche Name
        // bleibt die volle Bezeichnung und enthält den sichtbaren Text (WCAG 2.5.3).
        const visibleLabel = area.id === "admin" ? t("shell.tabBar.adminShort") : label;
        const active = area.id === activeArea;
        return (
          <Link
            key={area.id}
            href={href}
            aria-current={active ? "page" : undefined}
            aria-label={label}
            className={cn(
              TAB_CLASS,
              active
                ? "bg-gold-500 text-navy-900"
                : "text-sidebar-foreground/75 hover:text-sidebar-foreground",
            )}
          >
            <Icon size={TAB_ICON_PX} strokeWidth={1.5} aria-hidden />
            {active && !minimized ? <span className="min-w-0 truncate">{visibleLabel}</span> : null}
          </Link>
        );
      })}
      <button
        type="button"
        aria-label={t("shell.tabBar.search")}
        onClick={openSearch}
        className={cn(TAB_CLASS, "text-sidebar-foreground/75 hover:text-sidebar-foreground")}
      >
        <Search size={TAB_ICON_PX} strokeWidth={1.5} aria-hidden />
      </button>
    </nav>
  );
}
