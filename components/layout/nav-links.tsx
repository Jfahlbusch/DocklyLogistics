"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import type { UserRole } from "@/lib/auth/role";
import { findActiveEntry, visibleAreas, visibleEntries, type NavArea } from "@/lib/navigation";
import { useNavigationState } from "./navigation-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NavAreaTrigger } from "./nav-area-trigger";
import { NavLinkList } from "./nav-link-list";
import { cn } from "@/lib/utils";

/**
 * Unabhängig geöffnete Bereiche. Jeder Bereich öffnet sich direkt im Menü; reicht die Höhe nicht, scrollt die Bereichsliste
 * (Nutzerwunsch 18.10.2026, abweichend von der Vorlage, die bei Platzmangel Popover nutzt). Popover nur noch für zugeklappte Bereiche
 * der eingeklappten Leiste (Rail) — dort gibt es keinen Bereichskopf zum Aufklappen.
 */
export function NavLinks({ role, allowed, collapsed, onNavigate }: {
  role: UserRole; allowed?: readonly string[]; collapsed?: boolean; onNavigate?: () => void;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const prefix = useId();
  // `allowed`: Feature-Rechte des Nutzers (Abweichung von der Vorlage, siehe lib/navigation.ts).
  const entries = visibleEntries(role, undefined, allowed);
  const active = findActiveEntry(pathname);
  const { open: openAreas, toggle } = useNavigationState();
  const [popup, setPopup] = useState<NavArea | null>(null);
  const navRef = useRef<HTMLElement>(null);
  // Aktiven Eintrag nach Seitenwechsel ins Bild holen — die Bereichsliste kann scrollen.
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
  }, [active?.id, collapsed]);

  const pick = () => { setPopup(null); onNavigate?.(); };
  const list = (area: NavArea, inPopup: boolean) => <NavLinkList entries={entries} area={area} activeId={active?.id} inPopup={inPopup} onPick={pick} />;

  return (
    // Portal-Aufbau (.sidebar-scroll > .nav-sidebar): Bereiche mit Überschrift, Zielliste mit 1,6 px Abstand und 11,2 px Seitenrand.
    // Eingeklappt (Rail) trennt eine Linie (16 px Rand) die Bereiche. Aufgeklappte Bereiche zeigen ihre Ziele als Icon-Kacheln (Nutzerwunsch
    // 18.10.2026), zugeklappte sind eine Bereichskachel mit Popover. Bei Platzmangel scrollt die Liste (Marke/Karte/Profilzeile bleiben fest).
    <nav ref={navRef} aria-label={t("shell.mainNavigation")} className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
      {visibleAreas(role, undefined, allowed).map((area, index) => {
        const label = t(area.labelKey);
        const open = openAreas[area.id];
        const flyout = !!collapsed && !open;
        const railOpen = collapsed && !flyout;
        const labelId = `${prefix}-${area.id}`;
        const trigger = (
          <NavAreaTrigger id={labelId} label={label} icon={area.icon} collapsed={collapsed} open={!flyout && open} current={active?.area === area.id}
            aria-expanded={flyout ? popup === area.id : open} aria-controls={flyout ? undefined : `${labelId}-links`}
            onClick={flyout ? undefined : () => toggle(area.id)} />
        );
        return (
          <div key={area.id} role="group" aria-label={label} className="pt-2 short:pt-1 max-nav:pt-0 tiny:pt-0">
            {collapsed && index > 0 && <div aria-hidden className="mx-4 mb-1 border-t border-sidebar-border tiny:hidden" />}
            {railOpen ? (
              <div className="flex flex-col gap-[0.1rem] px-3 py-1 tiny:py-0.5">
                <NavLinkList entries={entries} area={area.id} activeId={active?.id} inPopup={false} iconOnly onPick={pick} />
              </div>
            ) : flyout ? (
              <Popover open={popup === area.id} onOpenChange={(next) => setPopup(next ? area.id : null)}>
                <div className={cn("relative", collapsed && "px-3 py-1 tiny:py-0.5")}>
                  <PopoverTrigger asChild>{trigger}</PopoverTrigger>
                </div>
                <PopoverContent side="right" align="start" className="w-64 max-w-[calc(100vw-1rem)] p-2" aria-label={label}>
                  {list(area.id, true)}
                </PopoverContent>
              </Popover>
            ) : <>{trigger}<div id={`${labelId}-links`} hidden={!open} className="flex flex-col gap-[0.1rem] px-[0.7rem] py-1 max-nav:py-0">{list(area.id, false)}</div></>}
          </div>
        );
      })}
    </nav>
  );
}
