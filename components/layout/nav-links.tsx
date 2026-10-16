"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import type { UserRole } from "@/lib/auth/role";
import { findActiveEntry, visibleAreas, visibleEntries, type NavArea } from "@/lib/navigation";
import { useMediaQuery } from "@/hooks/use-media-query";
import { navigationFlyouts, type NavigationDensity } from "@/lib/navigation-preference";
import { useNavigationState } from "./navigation-state";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "@/components/ui/popover";
import { NavAreaTrigger } from "./nav-area-trigger";
import { NavLinkList } from "./nav-link-list";
import { cn } from "@/lib/utils";

/** Unabhängig geöffnete Bereiche; bei Platzmangel bleiben Ziele im Popover erreichbar. */
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
  // Drawer unter 992 px (Portal-Breakpoint `lg`, bei uns `nav:`); Touch-Bedienung bekommt auch am Desktop die 44-px-Maße.
  const drawer = useMediaQuery("(width < 62rem)");
  const coarse = useMediaQuery("(pointer: coarse)");
  const compact = useMediaQuery("(max-height: 900px)");
  const density: NavigationDensity = drawer || coarse ? "touch" : compact ? "compact" : "normal";
  const navRef = useRef<HTMLElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const element = navRef.current;
    if (!element) return;
    const measure = () => setHeight(element.clientHeight > 0 ? element.clientHeight : null);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  const overflowAreas = navigationFlyouts(entries, openAreas, height, density);

  const pick = () => { setPopup(null); onNavigate?.(); };
  const list = (area: NavArea, inPopup: boolean) => <NavLinkList entries={entries} area={area} activeId={active?.id} inPopup={inPopup} onPick={pick} />;

  return (
    // Portal-Aufbau (.sidebar-scroll > .nav-sidebar): Bereiche mit Überschrift, Zielliste mit 1,6 px Abstand und 11,2 px Seitenrand.
    // Eingeklappt (Rail) trennt eine Linie (16 px Rand) die Bereiche, jeder Bereich ist eine Kachel mit Popover.
    <nav ref={navRef} aria-label={t("shell.mainNavigation")} className="min-h-0 flex-1 overflow-hidden">
      {visibleAreas(role, undefined, allowed).map((area, index) => {
        const label = t(area.labelKey);
        const open = openAreas[area.id];
        const flyout = collapsed || overflowAreas.has(area.id);
        const labelId = `${prefix}-${area.id}`;
        const trigger = (
          <NavAreaTrigger id={labelId} label={label} icon={area.icon} collapsed={collapsed} open={!flyout && open} current={active?.area === area.id}
            aria-expanded={flyout ? popup === area.id : open} aria-controls={flyout ? undefined : `${labelId}-links`}
            onClick={flyout ? undefined : () => toggle(area.id)} />
        );
        return (
          <div key={area.id} role="group" aria-label={label} className="pt-2 short:pt-1 max-nav:pt-0 tiny:pt-0">
            {collapsed && index > 0 && <div aria-hidden className="mx-4 mb-1 border-t border-sidebar-border tiny:hidden" />}
            {flyout ? (
              <Popover open={popup === area.id} onOpenChange={(next) => setPopup(next ? area.id : null)}>
                <div className={cn("relative", collapsed && "px-3 py-1 tiny:py-0.5")}>
                  <PopoverTrigger asChild>{trigger}</PopoverTrigger>
                  {/* Desktop nutzt die ganze Schaltfläche. Im schmalen Drawer registriert
                      sich der kompakte Anker danach, damit ihn der erste Trigger nicht ersetzt. */}
                  {drawer && <PopoverAnchor asChild><span aria-hidden className="pointer-events-none absolute left-0 top-0 size-11" /></PopoverAnchor>}
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
