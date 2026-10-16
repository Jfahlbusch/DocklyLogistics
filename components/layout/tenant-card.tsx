import { Building2, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Rahmen der Unternehmens-Karte (Portal: `.sidebar-tenant-btn` mit `d-flex align-items-center gap-2 w-100 p-2`): 8 px Innenabstand und
 * Abstand, Radius 10 px, 1 px Linie auf aufgehellter Fläche (Hover 11 % statt 8 %). Eingeklappt bleibt die Karte stehen, das Symbol
 * wandert in die Mitte. Fremde Ansicht (Plattform-Admin) tönt die Karte Gold. Im Querformat-Handy entfällt die Überschrift.
 */
export function tenantCardClass({ collapsed, foreign, interactive }: { collapsed?: boolean; foreign?: boolean; interactive?: boolean }) {
  return cn(
    "flex min-h-11 w-full items-center gap-2 rounded-[10px] border p-2 text-left text-sidebar-foreground transition-colors duration-200",
    collapsed && "justify-center",
    foreign ? "border-gold-400/40 bg-gold-400/10" : "border-sidebar-border bg-sidebar-foreground/[0.08]",
    interactive && (foreign ? "hover:bg-gold-400/20" : "hover:bg-sidebar-foreground/[0.11]"),
    interactive && "outline-none focus-visible:ring-2 focus-visible:ring-ring",
  );
}

/**
 * Inhalt der Karte (Portal: `_tenant_switcher.html.erb`): Gebäude-Symbol in der Akzentfarbe (20 px), links daneben die Überschrift
 * „Unternehmen“ (Großbuchstaben, 0,05 em gesperrt, 75 % Schriftfarbe) über dem Namen (16 px / 600), rechts der Auswahlpfeil (60 % Schriftfarbe; keine Deckkraft, siehe status-contrast.test.ts).
 * Die Überschrift hat 12 px statt 10,9 px (Mindestgröße L9).
 */
export function TenantCardBody({ name, collapsed, open, withChevron }: { name: string; collapsed?: boolean; open?: boolean; withChevron?: boolean }) {
  const t = useTranslations("shell.tenantSwitcher");
  return (
    <>
      <Building2 size={20} strokeWidth={1.5} aria-hidden className="shrink-0 text-gold-400" />
      {!collapsed && (
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-xs uppercase tracking-[0.05em] text-sidebar-foreground/75 tiny:hidden">{t("caption")}</span>
          <span className="truncate font-semibold">{name}</span>
        </span>
      )}
      {!collapsed && withChevron && <ChevronsUpDown data-slot="tenant-caret" size={16} aria-hidden className={cn("shrink-0 text-sidebar-foreground/60 transition-colors", open && "text-gold-400")} />}
    </>
  );
}
