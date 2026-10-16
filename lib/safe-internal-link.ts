/**
 * Nur Ziele innerhalb der eigenen App zulassen (kein Open Redirect über Links in
 * Benachrichtigungen o. Ä.). Statt Textmustern zählt das, was der Browser tatsächlich
 * ansteuern würde: der URL-Parser entfernt Tabs/Zeilenumbrüche und liest `\` wie `/`,
 * so dass etwa `/\evil.example` oder `/<TAB>/evil.example` zu `//evil.example` werden.
 * Erlaubt ist nur ein Pfad mit führendem `/`, der auf denselben Origin auflöst.
 * Rückgabe: Pfad + Query + Hash (ohne Origin) oder `null`.
 */
export function safeInternalLink(link: string | null | undefined, origin: string): string | null {
  if (!link || !link.startsWith("/") || link.startsWith("//") || link.includes("\\")) return null;
  let url: URL;
  try {
    url = new URL(link, origin);
  } catch {
    return null;
  }
  if (url.origin !== new URL(origin).origin) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
