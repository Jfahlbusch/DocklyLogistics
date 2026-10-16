"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { NavArea, NavEntry } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { NAV_ICON_PX, navIconClass, navTileClass } from "./nav-item-class";

/** Ziele eines Bereichs: im Menü Portal-Einträge, im Popover die hellen Popover-Zeilen. */
export function NavLinkList({ entries, area, activeId, inPopup, onPick }: {
  entries: readonly NavEntry[]; area: NavArea; activeId?: string; inPopup: boolean; onPick: () => void;
}) {
  const t = useTranslations();
  return entries.filter((entry) => entry.area === area).map((entry) => {
    const Icon = entry.icon;
    const selected = entry.id === activeId;
    return (
      <Link key={entry.id} href={entry.href} aria-current={selected ? "page" : undefined} onClick={onPick}
        className={inPopup
          ? cn("flex min-h-11 items-center gap-3 rounded-md px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", selected ? "bg-muted font-medium text-foreground" : "text-foreground hover:bg-muted")
          : navTileClass(selected)}
      >
        {inPopup
          ? <Icon size={20} strokeWidth={1.5} aria-hidden className="shrink-0" />
          : <span className={navIconClass(selected)}><Icon size={NAV_ICON_PX} strokeWidth={1.5} aria-hidden /></span>}
        <span className="min-w-0 truncate">{t(entry.labelKey)}</span>
      </Link>
    );
  });
}
