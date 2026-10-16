import type messages from "./messages/de.json";
import type { routing } from "./i18n/routing";

// Typisierung für next-intl: Schlüssel und Sprache stammen aus `messages/de.json` bzw. `i18n/routing.ts`.
// Unbekannte Schlüssel in `t("…")` und `labelKey` scheitern damit im Typecheck.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
