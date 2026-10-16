import { initials } from "@/lib/user-display";
import { cn } from "@/lib/utils";

/** Statischer Mandanten-Chip direkt unter dem Brand-Kopf: Initialen-Kachel + Name; eingeklappt nur die Kachel. */
export function TenantChip({ tenant, collapsed }: { tenant: string; collapsed?: boolean }) {
  return (
    <div
      className={cn("flex items-center", collapsed ? "justify-center px-2 pt-3" : "gap-2.5 px-5 pt-4")}
      title={collapsed ? tenant : undefined}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 text-[11px] font-medium text-white">
        {initials(tenant)}
      </div>
      {!collapsed && <span className="min-w-0 truncate text-sm text-white/80">{tenant}</span>}
    </div>
  );
}
