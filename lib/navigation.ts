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
 * Bereichs (`areaHref`) — die mobile Tab-Leiste führt je Bereich einen Tab dorthin, danach die Suche.
 */
export const NAV_ENTRIES: readonly NavEntry[] = [
  // Übersicht
  { id: "dashboard", area: "overview", labelKey: "nav.dashboard", href: "/dashboard", icon: Home },
  // Einkauf
  { id: "suggestions", area: "purchasing", labelKey: "nav.suggestions", href: "/order-suggestions", icon: ListChecks },
  { id: "orders", area: "purchasing", labelKey: "nav.orders", href: "/orders", icon: ShoppingCart },
  { id: "edi", area: "purchasing", labelKey: "nav.edi", href: "/edi", icon: ArrowLeftRight },
  { id: "reports", area: "purchasing", labelKey: "nav.reports", href: "/reports", icon: BarChart3 },
  // Lager
  { id: "stock", area: "warehouse", labelKey: "nav.stock", href: "/stock", icon: Box },
  { id: "warehouse", area: "warehouse", labelKey: "nav.warehouse", href: "/warehouse-mode", icon: ScanLine },
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

/** Deutscher Text zu einem `nav.*`-Key (die App ist vorerst nur Deutsch, siehe `i18n/request.ts`). */
function germanLabel(key: NavLabelKey): string {
  let node: unknown = de;
  for (const part of key.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
  if (typeof node !== "string") throw new Error(`Fehlender Text für ${key} in messages/de.json`);
  return node;
}

export type PaletteNavEntry = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Bereichsname der Registry (Übersicht/Einkauf/Lager/Verwaltung). */
  group: string;
};

/** Navigationstreffer der ⌘K-Palette: nur erlaubte Einträge, Label-Filter (case-insensitiv), Bereichs- und Registry-Reihenfolge. */
export function paletteNavEntries(query: string, allowed?: readonly string[]): PaletteNavEntry[] {
  const q = query.trim().toLowerCase();
  return NAV_AREAS.flatMap((area) =>
    NAV_ENTRIES.filter((entry) => entry.area === area.id && (allowed === undefined || allowed.includes(entry.id)))
      .map((entry) => ({ id: entry.id, label: germanLabel(entry.labelKey), href: entry.href, icon: entry.icon, group: germanLabel(area.labelKey) }))
      .filter((entry) => !q || entry.label.toLowerCase().includes(q)),
  );
}
