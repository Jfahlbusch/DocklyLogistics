import {
  Home, Package, Truck, Box, ScanLine, ListChecks, ShoppingCart,
  ArrowLeftRight, BarChart3, ShieldCheck, Settings, Building2,
  type LucideIcon,
} from "lucide-react";

export type NavGroupId = "einkauf" | "lager" | "verwaltung";

export const NAV_GROUPS: { id: NavGroupId; label: string }[] = [
  { id: "einkauf", label: "Einkauf" },
  { id: "lager", label: "Lager" },
  { id: "verwaltung", label: "Verwaltung" },
];

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  group: NavGroupId;
  /** In der mobilen Tab-Leiste anzeigen (max. 4). */
  tab?: boolean;
  accent?: boolean;
};

/** Einzige Quelle der Navigation. Reihenfolge = Anzeigereihenfolge. */
export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard",   label: "Dashboard",           href: "/dashboard",         icon: Home,           group: "einkauf",    tab: true },
  { id: "suggestions", label: "Bestellvorschläge",   href: "/order-suggestions", icon: ListChecks,     group: "einkauf" },
  { id: "orders",      label: "Bestellungen",        href: "/orders",            icon: ShoppingCart,   group: "einkauf",    tab: true },
  { id: "edi",         label: "EDI",                 href: "/edi",               icon: ArrowLeftRight, group: "einkauf" },
  { id: "reports",     label: "Reports",             href: "/reports",           icon: BarChart3,      group: "einkauf" },
  { id: "stock",       label: "Lager & Bestand",     href: "/stock",             icon: Box,            group: "lager",      tab: true },
  { id: "warehouse",   label: "Lagermodus",          href: "/warehouse-mode",    icon: ScanLine,       group: "lager",      tab: true, accent: true },
  { id: "articles",    label: "Artikel / Rohstoffe", href: "/articles",          icon: Package,        group: "lager" },
  { id: "suppliers",   label: "Lieferanten",         href: "/suppliers",         icon: Truck,          group: "lager" },
  { id: "audit",       label: "Audit",               href: "/audit",             icon: ShieldCheck,    group: "verwaltung" },
  { id: "settings",    label: "Einstellungen",       href: "/settings",          icon: Settings,       group: "verwaltung" },
  { id: "admin",       label: "Administration",      href: "/admin",             icon: Building2,      group: "verwaltung" },
];

const MAX_TABS = 4;

function isAllowed(item: NavItem, allowed?: string[]): boolean {
  return allowed === undefined || allowed.includes(item.id);
}

/** Einträge je Gruppe (nur erlaubte IDs; undefined = alle), leere Gruppen entfallen. */
export function navGroups(allowed?: string[]): { id: NavGroupId; label: string; items: NavItem[] }[] {
  return NAV_GROUPS
    .map((g) => ({
      ...g,
      items: NAV_ITEMS.filter((i) => i.group === g.id && isAllowed(i, allowed)),
    }))
    .filter((g) => g.items.length > 0);
}

/** Einträge der mobilen Tab-Leiste (höchstens 4, Registry-Reihenfolge). */
export function tabItems(allowed?: string[]): NavItem[] {
  return NAV_ITEMS.filter((i) => i.tab && isAllowed(i, allowed)).slice(0, MAX_TABS);
}

/** ID des Eintrags zum Pfad; bei mehreren Treffern gewinnt der längste href. */
export function activeNavId(pathname: string): string | undefined {
  let best: NavItem | undefined;
  for (const item of NAV_ITEMS) {
    const hit = pathname === item.href || pathname.startsWith(item.href + "/");
    if (hit && (!best || item.href.length > best.href.length)) best = item;
  }
  return best?.id;
}
