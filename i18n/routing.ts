// Platzhalter bis zur Mehrsprachigkeit — URL ohne Sprache.
// Die App ist vorerst nur Deutsch (Nutzerentscheidung): kein `[locale]`-Segment, keine Middleware-Umschreibung.
// Die Menü-Vorlagen (`assets/layout`) erwarten `routing.locales`/`routing.defaultLocale`; dieses Objekt hält sie kompilierbar.
// Kommt später eine zweite Sprache dazu, wird diese Datei durch `defineRouting` aus `next-intl/routing` ersetzt.
export const routing = {
  locales: ["de"],
  defaultLocale: "de",
} as const;

export type AppLocale = (typeof routing.locales)[number];
