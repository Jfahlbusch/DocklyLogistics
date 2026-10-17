import { safeInternalLink } from "@/lib/safe-internal-link";

/**
 * Rücksprungziel nach der Anmeldung: nur app-interne Pfade (kein Open Redirect über
 * `/login?callbackUrl=https://…`). Der Origin dient hier nur als Parse-Basis — ein
 * Pfad mit führendem `/` löst immer auf ihn auf, `safeInternalLink` lehnt alles andere ab.
 */
export function safeCallbackUrl(raw: string | null | undefined): string {
  return safeInternalLink(raw, "http://localhost") ?? "/dashboard";
}
