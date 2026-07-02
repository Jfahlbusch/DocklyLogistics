import {
  Home, Package, Truck, Box, ScanLine, ListChecks, ShoppingCart,
  ArrowLeftRight, BarChart3, ShieldCheck, Settings, Building2,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  accent?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard",   label: "Dashboard",           href: "/dashboard",          icon: Home },
  { id: "articles",    label: "Artikel / Rohstoffe", href: "/articles",           icon: Package },
  { id: "suppliers",   label: "Lieferanten",         href: "/suppliers",          icon: Truck },
  { id: "stock",       label: "Lager & Bestand",     href: "/stock",              icon: Box },
  { id: "warehouse",   label: "Lagermodus",          href: "/warehouse-mode",     icon: ScanLine, accent: true },
  { id: "suggestions", label: "Bestellvorschläge",   href: "/order-suggestions",  icon: ListChecks },
  { id: "orders",      label: "Bestellungen",        href: "/orders",             icon: ShoppingCart },
  { id: "edi",         label: "EDI",                 href: "/edi",                icon: ArrowLeftRight },
  { id: "reports",     label: "Reports",             href: "/reports",            icon: BarChart3 },
  { id: "audit",       label: "Audit",               href: "/audit",              icon: ShieldCheck },
  { id: "settings",    label: "Einstellungen",       href: "/settings",           icon: Settings },
  { id: "admin",       label: "Administration",      href: "/admin",              icon: Building2 },
];
