"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { activeNavId, tabItems } from "@/lib/navigation";
import { openSearch } from "@/components/search/open-search";
import { cn } from "@/lib/utils";
import { useScrollMinimized } from "./use-scroll-minimized";

/** ID des Scrollcontainers im App-Layout (`<section id="app-scroll">`). */
export const APP_SCROLL_ID = "app-scroll";

const tabBase =
  "flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center rounded-full px-1 text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";
const tabIdle = "hover:text-foreground active:bg-muted";
const tabActive = "bg-navy-900 font-medium text-white dark:bg-gold-500 dark:text-navy-900";
const tabLabelClass =
  "block max-h-4 overflow-hidden text-[10px] leading-4 transition-[max-height,opacity] duration-200 motion-reduce:transition-none group-data-[minimized=true]/pill:max-h-0 group-data-[minimized=true]/pill:opacity-0";

/**
 * Schwebende Bottom-Tab-Pill (nur unter md): bis zu vier Bereiche + Such-Tab, kein Profil-Tab.
 * Beim Herunterscrollen des Inhalts (`#app-scroll`) schrumpft sie auf reine Icons
 * (Labels klappen weg, Pill wird schmaler und rückt etwas tiefer); beim Hochscrollen kehrt sie zurück.
 */
export function TabBar({ allowedNav }: { allowedNav?: string[] }) {
  const pathname = usePathname();
  const activeId = activeNavId(pathname);
  const minimized = useScrollMinimized(APP_SCROLL_ID);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-30 flex justify-center px-3 md:hidden">
      <nav
        aria-label="Schnellzugriff"
        data-minimized={minimized}
        className={cn(
          "group/pill pointer-events-auto flex w-full items-center gap-0.5 rounded-full border border-border/60 bg-background/80 p-1.5 shadow-lg backdrop-blur-xl transition-[max-width,transform] duration-300 ease-out motion-reduce:transition-none",
          minimized ? "max-w-[17rem] translate-y-1" : "max-w-md",
        )}
      >
        {tabItems(allowedNav).map((item) => {
          const Icon = item.icon;
          const active = activeId === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(tabBase, active ? tabActive : tabIdle)}
            >
              <Icon size={22} strokeWidth={1.5} aria-hidden className="shrink-0" />
              <span className={tabLabelClass}>{item.tabLabel ?? item.label}</span>
            </Link>
          );
        })}
        <button type="button" onClick={openSearch} className={cn(tabBase, tabIdle)}>
          <Search size={22} strokeWidth={1.5} aria-hidden className="shrink-0" />
          <span className={tabLabelClass}>Suche</span>
        </button>
      </nav>
    </div>
  );
}
