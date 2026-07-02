import type { UserRole } from "@/lib/auth/role";

/**
 * The single registry of every manageable function in the app. The user/role
 * permission management lists exactly these — keep it complete: every nav area,
 * every write action, every settings sub-area.
 *
 * `minRole` is the built-in default gate (used when no explicit role/user config
 * exists). `navId` links an area feature to its NAV_ITEMS entry for visibility.
 */
export type FeatureDef = {
  key: string;
  label: string;
  group: string;
  minRole: UserRole;
  navId?: string;
};

export const FEATURES: FeatureDef[] = [
  { key: "dashboard", label: "Dashboard", group: "Bereiche", minRole: "VIEWER", navId: "dashboard" },

  { key: "articles", label: "Artikel / Rohstoffe ansehen", group: "Artikel", minRole: "VIEWER", navId: "articles" },
  { key: "articles.manage", label: "Artikel anlegen / bearbeiten / löschen", group: "Artikel", minRole: "USER" },
  { key: "articles.suppliers", label: "Artikel-Lieferanten pflegen", group: "Artikel", minRole: "USER" },

  { key: "suppliers", label: "Lieferanten ansehen", group: "Lieferanten", minRole: "VIEWER", navId: "suppliers" },
  { key: "suppliers.manage", label: "Lieferanten anlegen / bearbeiten", group: "Lieferanten", minRole: "USER" },

  { key: "stock", label: "Lager & Bestand ansehen", group: "Lager", minRole: "VIEWER", navId: "stock" },
  { key: "stock.inventory", label: "Inventur buchen", group: "Lager", minRole: "USER" },
  { key: "stock.locations", label: "Lagerplätze verwalten", group: "Lager", minRole: "USER" },
  { key: "warehouse", label: "Lagermodus (Scanner)", group: "Lager", minRole: "USER", navId: "warehouse" },

  { key: "suggestions", label: "Bestellvorschläge ansehen", group: "Bestellungen", minRole: "VIEWER", navId: "suggestions" },
  { key: "suggestions.confirm", label: "Vorschläge in Bestellungen umwandeln", group: "Bestellungen", minRole: "USER" },
  { key: "orders", label: "Bestellungen ansehen", group: "Bestellungen", minRole: "VIEWER", navId: "orders" },
  { key: "orders.create", label: "Bestellung anlegen", group: "Bestellungen", minRole: "USER" },
  { key: "orders.send", label: "Bestellung senden", group: "Bestellungen", minRole: "MANAGER" },

  { key: "edi", label: "EDI-Nachrichten ansehen (Monitor)", group: "EDI", minRole: "USER", navId: "edi" },
  { key: "edi.manage", label: "EDI verwalten (erneut verarbeiten, Postfach-Einstellungen)", group: "EDI", minRole: "MANAGER" },

  { key: "reports", label: "Reports ansehen", group: "Auswertung", minRole: "VIEWER", navId: "reports" },
  { key: "audit", label: "Audit-Log ansehen", group: "Auswertung", minRole: "MANAGER", navId: "audit" },

  { key: "settings", label: "Einstellungen öffnen", group: "Einstellungen", minRole: "MANAGER", navId: "settings" },
  { key: "settings.channels", label: "Versandprofile", group: "Einstellungen", minRole: "MANAGER" },
  { key: "settings.webhooks", label: "Webhooks", group: "Einstellungen", minRole: "MANAGER" },
  { key: "settings.apikeys", label: "API-Keys", group: "Einstellungen", minRole: "USER" },
  { key: "settings.pdf", label: "Bestellschein-Branding", group: "Einstellungen", minRole: "MANAGER" },
  { key: "settings.users", label: "Benutzer & Berechtigungen", group: "Einstellungen", minRole: "MANAGER" },

  { key: "admin", label: "Tenant-Verwaltung (Betreiber)", group: "Administration", minRole: "GLOBAL_ADMIN", navId: "admin" },
];

export const FEATURE_KEYS = FEATURES.map((f) => f.key);
const FEATURE_BY_KEY = new Map(FEATURES.map((f) => [f.key, f]));

export function isFeatureKey(key: string): boolean {
  return FEATURE_BY_KEY.has(key);
}

const RANK: Record<UserRole, number> = { GLOBAL_ADMIN: 4, MANAGER: 3, USER: 2, VIEWER: 1 };

/** Built-in default for a feature/role when no explicit config exists. */
export function defaultEnabled(role: UserRole, featureKey: string): boolean {
  const f = FEATURE_BY_KEY.get(featureKey);
  if (!f) return false;
  return RANK[role] >= RANK[f.minRole];
}

/**
 * Roles whose default feature set is configurable (per the spec: Manager + User).
 * GLOBAL_ADMIN always has everything; VIEWER keeps its built-in defaults. Per-user
 * overrides still work for users of any role.
 */
export const CONFIGURABLE_ROLES: UserRole[] = ["MANAGER", "USER"];

/** Features grouped for display, preserving registry order within each group. */
export function featuresByGroup(): { group: string; items: FeatureDef[] }[] {
  const groups: { group: string; items: FeatureDef[] }[] = [];
  for (const f of FEATURES) {
    let g = groups.find((x) => x.group === f.group);
    if (!g) {
      g = { group: f.group, items: [] };
      groups.push(g);
    }
    g.items.push(f);
  }
  return groups;
}
