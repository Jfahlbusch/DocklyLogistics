import { cn } from "@/lib/utils";

/**
 * Sidebar-Kopf: Logo-Kachel + App-Name — wird eingeklappt auf die Kachel
 * reduziert. Der Schriftzug folgt DocklyBIs Poppins-ExtraBold-Technik
 * (kursives Kleinschreibungs-Präfix + aufrechtes Großschreibungs-Suffix,
 * font-weight 800 über --font-poppins). DocklyLogistics hat kein Tenant-Logo-Upload,
 * daher ein fest verdrahteter Schriftzug statt einer TenantLogo-Fallback-Kette.
 */
export function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center border-b border-white/10",
        collapsed ? "justify-center px-2 py-5" : "gap-3 px-5 py-6",
      )}
    >
      <div
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 800 }}
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gold-400 to-gold-700 text-lg text-navy-900"
      >
        D
      </div>
      {!collapsed && (
        <div className="min-w-0">
          <div
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 800 }}
            className="truncate text-lg leading-none text-sidebar-foreground"
          >
            <span className="italic">dockly</span>
            <span className="ml-1 uppercase tracking-[0.01em]">LOGISTICS</span>
          </div>
          <div className="mt-1.5 truncate text-[11px] uppercase tracking-wide text-sidebar-foreground/60">
            Rohstoff-Logistik
          </div>
        </div>
      )}
    </div>
  );
}
