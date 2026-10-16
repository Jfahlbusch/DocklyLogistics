// Platzhalter bis zur Mehrsprachigkeit — URL ohne Sprache.
// Die Menü-Vorlagen importieren `Link`, `usePathname`, `useRouter`, `redirect` und `getPathname` aus `@/i18n/navigation`
// (dort ergänzt next-intl das Sprachpräfix). Solange die URLs sprachlos bleiben, reichen wir die Next.js-Bausteine unverändert
// durch; `getPathname` liefert den Pfad ohne Präfix zurück. Später ersetzt `createNavigation(routing)` diese Datei.
export { default as Link } from "next/link";
export { usePathname, useRouter, redirect } from "next/navigation";

/** Pfad ohne Sprachpräfix; `locale` wird ignoriert (Signatur wie bei next-intl). */
export function getPathname({ href }: { href: string; locale?: string }): string {
  return href;
}
