import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

/**
 * Menükopf wie `.sidebar-brand` im Portal (develop 1aff3fd): Marke in einer Zeile, mittig, 30 px hoch, Innenabstand 22,4 / 22,4 / 14,4 px
 * (oben / seitlich / unten), keine Trennlinie. Eingeklappt (Rail) bleibt nur die Marke mit 12 px seitlich. Die Marke führt zur Startseite.
 * Die Navy-Fläche nutzt stets die weiße Variante. Auf niedrigen Displays (≤ 900 px) rückt der Kopf zusammen, im Querformat-Handy
 * (≤ 400 px) entfällt er, damit die Bereiche in die Displayhöhe passen. Im Drawer (unter 992 px) bleibt rechts Platz für den Schließen-Knopf des Sheets.
 */
export function Brand({ collapsed }: { collapsed?: boolean }) {
  const t = useTranslations("common");
  return (
    <div className={cn("flex shrink-0 items-center justify-center pb-[0.9rem] pt-[1.4rem] short:pb-2 short:pt-3 tiny:hidden", collapsed ? "px-3" : "px-[1.4rem] max-nav:ps-4 max-nav:pe-14")}>
      <Link href="/" aria-label={t("appName")} className="inline-flex rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Logo size="sm" variant="dark" inline markOnly={collapsed} />
      </Link>
    </div>
  );
}
