import {
  ArrowLeftRight,
  BarChart3,
  Box,
  Building2,
  Home,
  LayoutDashboard,
  ListChecks,
  Package,
  ScanLine,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { MessageKeys, Messages, NestedKeyOf } from "next-intl";
import { hasMinRole, type UserRole } from "@/lib/auth/role";
import de from "../messages/de.json";

// Navigations-Registry (Modell der Vorlage assets/layout/lib/navigation.ts, seitenmenue.md): EINE Definition speist Sidebar,
// Drawer, Tab-Leiste und ⌘K-Palette. Neue Screens tragen hier genau einen Eintrag ein, statt mehrere Menüs zu pflegen.
// Sichtbarkeit: bei uns über Feature-Rechte (`allowed` = erlaubte Eintrags-IDs, siehe `lib/features.ts` `navId` und
// `app/(app)/layout.tsx`), `minRole` bleibt als optionale Zusatzschranke aus der Vorlage erhalten.

/** Top-Level-Bereich (max. 4 — Reihenfolge = Reihenfolge im Cookie `ui_nav_areas`, siehe `lib/navigation-preference.ts`). */
export type NavArea = "overview" | "purchasing" | "warehouse" | "admin";

/** Message-Key unter `nav.*`; unbekannte Keys scheitern im Typecheck (Quelle: messages/de.json). */
export type NavLabelKey = Extract<MessageKeys<Messages, NestedKeyOf<Messages>>, `nav.${string}`>;

export type NavAreaDefinition = {
  readonly id: NavArea;
  readonly labelKey: NavLabelKey;
  readonly icon: LucideIcon;
};

export type NavEntry = {
  /** Stabile ID; hängt an `lib/features.ts` (`navId`) und an der Feature-Filterung (`allowedNav`) — nie umbenennen. */
  readonly id: string;
  readonly area: NavArea;
  readonly labelKey: NavLabelKey;
  /** Pfad ohne Sprachpräfix (`/articles`); die URLs sind sprachlos (`@/i18n/navigation`). */
  readonly href: string;
  readonly icon: LucideIcon;
  /** Mindestrolle, ab der der Eintrag sichtbar ist — fehlt = für alle Rollen sichtbar (bei uns regeln Feature-Rechte die Sichtbarkeit). */
  readonly minRole?: UserRole;
  /**
   * Standard `true`: Der Eintrag erscheint in der Segment-Pill seines Bereichs.
   * `false`: nur in Sidebar, Drawer und ⌘K (z. B. Unterseiten ohne eigenes Segment).
   */
  readonly segment?: boolean;
  /**
   * Projektspezifisch (nicht in der Vorlage), bis S2 die Tab-Leiste umstellt: Eintrag erscheint als Tab der mobilen Leiste
   * (höchstens 4) mit diesem Kurzlabel (`nav.tab.*`).
   */
  readonly tabLabelKey?: NavLabelKey;
  /** Projektspezifisch: Scan-Akzent (Lagermodus) in der Darstellung. */
  readonly accent?: boolean;
};

/** Bereiche in Anzeigereihenfolge (Übersicht zuerst, Verwaltung zuletzt). */
export const NAV_AREAS: readonly NavAreaDefinition[] = [
  { id: "overview", labelKey: "nav.areas.overview", icon: LayoutDashboard },
  { id: "purchasing", labelKey: "nav.areas.purchasing", icon: ShoppingCart },
  { id: "warehouse", labelKey: "nav.areas.warehouse", icon: Box },
  { id: "admin", labelKey: "nav.areas.admin", icon: Settings },
];

/**
 * Alle Einträge; die Reihenfolge innerhalb eines Bereichs ist die Anzeigereihenfolge, der erste sichtbare Eintrag ist das Ziel des
 * Bereichs (`areaHref`). Die Tab-Leiste führt dashboard, orders, stock, warehouse (`tabLabelKey`), danach die Suche.
 */
export const NAV_ENTRIES: readonly NavEntry[] = [
  // Übersicht
  { id: "dashboard", area: "overview", labelKey: "nav.dashboard", href: "/dashboard", icon: Home, tabLabelKey: "nav.tab.dashboard" },
  // Einkauf
  { id: "suggestions", area: "purchasing", labelKey: "nav.suggestions", href: "/order-suggestions", icon: ListChecks },
  { id: "orders", area: "purchasing", labelKey: "nav.orders", href: "/orders", icon: ShoppingCart, tabLabelKey: "nav.tab.orders" },
  { id: "edi", area: "purchasing", labelKey: "nav.edi", href: "/edi", icon: ArrowLeftRight },
  { id: "reports", area: "purchasing", labelKey: "nav.reports", href: "/reports", icon: BarChart3 },
  // Lager
  { id: "stock", area: "warehouse", labelKey: "nav.stock", href: "/stock", icon: Box, tabLabelKey: "nav.tab.stock" },
  { id: "warehouse", area: "warehouse", labelKey: "nav.warehouse", href: "/warehouse-mode", icon: ScanLine, tabLabelKey: "nav.tab.warehouse", accent: true },
  { id: "articles", area: "warehouse", labelKey: "nav.articles", href: "/articles", icon: Package },
  { id: "suppliers", area: "warehouse", labelKey: "nav.suppliers", href: "/suppliers", icon: Truck },
  // Verwaltung
  { id: "audit", area: "admin", labelKey: "nav.audit", href: "/audit", icon: ShieldCheck },
  { id: "settings", area: "admin", labelKey: "nav.settings", href: "/settings", icon: Settings },
  { id: "admin", area: "admin", labelKey: "nav.admin", href: "/admin", icon: Building2 },
];

// Der optionale Parameter `entries` dient Tests und künftigen Erweiterungen; die Anwendung nutzt immer `NAV_ENTRIES`.
// `allowed` (Abweichung von der Vorlage): erlaubte Eintrags-IDs aus den Feature-Rechten; `undefined` = alle.

/** Einträge, die `role` sehen darf und die (falls angegeben) in `allowed` stehen — Registry-Reihenfolge. */
export function visibleEntries(
  role: UserRole,
  entries: readonly NavEntry[] = NAV_ENTRIES,
  allowed?: readonly string[],
): NavEntry[] {
  return entries.filter(
    (entry) =>
      (!entry.minRole || hasMinRole(role, entry.minRole)) && (allowed === undefined || allowed.includes(entry.id)),
  );
}

/** Bereiche mit mindestens einem sichtbaren Eintrag — leere Bereiche verschwinden generisch. */
export function visibleAreas(
  role: UserRole,
  entries: readonly NavEntry[] = NAV_ENTRIES,
  allowed?: readonly string[],
): NavAreaDefinition[] {
  const areasWithEntries = new Set(visibleEntries(role, entries, allowed).map((entry) => entry.area));
  return NAV_AREAS.filter((area) => areasWithEntries.has(area.id));
}

/** Ziel eines Bereichs: `href` seines ersten sichtbaren Eintrags, sonst `null`. */
export function areaHref(
  area: NavArea,
  role: UserRole,
  entries: readonly NavEntry[] = NAV_ENTRIES,
  allowed?: readonly string[],
): string | null {
  return visibleEntries(role, entries, allowed).find((entry) => entry.area === area)?.href ?? null;
}

/** Sichtbare Einträge eines Bereichs für die Segment-Pill (ohne `segment: false`). */
export function segmentEntries(
  area: NavArea,
  role: UserRole,
  entries: readonly NavEntry[] = NAV_ENTRIES,
  allowed?: readonly string[],
): NavEntry[] {
  return visibleEntries(role, entries, allowed).filter((entry) => entry.area === area && entry.segment !== false);
}

/** `/` greift nur exakt, alle anderen Einträge auch für Unterpfade (an Segmentgrenzen). */
function matchesPath(path: string, href: string): boolean {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

/**
 * Aktiver Eintrag für einen Pfad (`usePathname`): längster passender Präfix, `null` wenn kein Eintrag passt. Rollen und Rechte spielen
 * hier keine Rolle — die Seiten-Guards entscheiden über den Zugriff. `/order-suggestions` trifft nie `/orders` (Segmentgrenze).
 */
export function findActiveEntry(path: string, entries: readonly NavEntry[] = NAV_ENTRIES): NavEntry | null {
  let active: NavEntry | null = null;
  for (const entry of entries) {
    if (matchesPath(path, entry.href) && (!active || entry.href.length > active.href.length)) {
      active = entry;
    }
  }
  return active;
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Kompatible Wrapper für die bestehenden Aufrufer (Sidebar, Drawer, Tab-Leiste, ⌘K-Palette, Topbar, Feature-Filter in
// `app/(app)/layout.tsx`). Sie leiten sich vollständig aus der Registry oben ab und liefern die bisherigen Formen mit fertigen
// deutschen Texten (aus messages/de.json). S2 ersetzt die Aufrufer durch die Menü-Komponenten der Vorlage; danach entfällt dieser Block.
// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Bisherige Gruppen des Menüs (Übersicht gehörte zu „Einkauf“, damit die App in S1 unverändert aussieht). */
export type NavGroupId = "einkauf" | "lager" | "verwaltung";

const LEGACY_GROUP: Record<NavArea, NavGroupId> = {
  overview: "einkauf",
  purchasing: "einkauf",
  warehouse: "lager",
  admin: "verwaltung",
};

/** Deutscher Text zu einem `nav.*`-Key (die App ist vorerst nur Deutsch, siehe `i18n/request.ts`). */
function germanLabel(key: NavLabelKey): string {
  let node: unknown = de;
  for (const part of key.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
  if (typeof node !== "string") throw new Error(`Fehlender Text für ${key} in messages/de.json`);
  return node;
}

export const NAV_GROUPS: { id: NavGroupId; label: string }[] = [
  { id: "einkauf", label: germanLabel("nav.areas.purchasing") },
  { id: "lager", label: germanLabel("nav.areas.warehouse") },
  { id: "verwaltung", label: germanLabel("nav.areas.admin") },
];

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  group: NavGroupId;
  /** In der mobilen Tab-Leiste anzeigen (max. 4). */
  tab?: boolean;
  /** Kurzlabel für die mobile Tab-Pill (Pflicht bei `tab: true`). */
  tabLabel?: string;
  accent?: boolean;
};

/** Einträge in der bisherigen Form (Registry-Reihenfolge). */
export const NAV_ITEMS: NavItem[] = NAV_ENTRIES.map((entry) => ({
  id: entry.id,
  label: germanLabel(entry.labelKey),
  href: entry.href,
  icon: entry.icon,
  group: LEGACY_GROUP[entry.area],
  ...(entry.tabLabelKey ? { tab: true, tabLabel: germanLabel(entry.tabLabelKey) } : {}),
  ...(entry.accent ? { accent: true } : {}),
}));

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
  return findActiveEntry(pathname)?.id;
}

export type PaletteNavEntry = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Gruppen-Label der Registry (Einkauf/Lager/Verwaltung). */
  group: string;
};

/** Navigationstreffer der Command-Palette: nur erlaubte Einträge, Label-Filter (case-insensitiv), Registry-Reihenfolge. */
export function paletteNavEntries(query: string, allowed?: string[]): PaletteNavEntry[] {
  const q = query.trim().toLowerCase();
  return navGroups(allowed).flatMap((g) =>
    g.items
      .filter((i) => !q || i.label.toLowerCase().includes(q))
      .map((i) => ({ id: i.id, label: i.label, href: i.href, icon: i.icon, group: g.label })),
  );
}
