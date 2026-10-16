import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

// Nur Deutsch, ohne URL-Sprache (Platzhalter bis zur Mehrsprachigkeit): Die Sprache steht fest, die Texte kommen aus `messages/de.json`.
export default getRequestConfig(async () => ({
  locale: routing.defaultLocale,
  messages: (await import("../messages/de.json")).default,
}));
