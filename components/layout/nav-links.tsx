"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeNavId, navGroups } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** The sidebar navigation (grouped per Dockly menu anatomy). Shared by the desktop Sidebar and the mobile drawer. */
export function NavLinks({
  onNavigate,
  collapsed,
  allowedNav,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  allowedNav?: string[];
}) {
  const pathname = usePathname();
  const activeId = activeNavId(pathname);
  const groups = navGroups(allowedNav);
  return (
    <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3" aria-label="Hauptnavigation">
      {groups.map((group, index) => (
        <div key={group.id} className={cn(index > 0 && (collapsed ? "mt-3 border-t border-white/10 pt-3" : "mt-5"))}>
          {!collapsed && (
            <div className="px-3 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-white/60">
              {group.label}
            </div>
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = activeId === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg py-3.5 text-base transition-colors lg:py-2.5 lg:text-sm",
                    collapsed ? "justify-center px-0" : "px-3",
                    active
                      ? "bg-sidebar-accent font-medium text-white"
                      : "font-normal text-white/70 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon
                    size={16}
                    strokeWidth={1.5}
                    className={cn("shrink-0", active ? "text-gold-400" : item.accent ? "text-gold-500" : "text-white/60")}
                  />
                  {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                  {!collapsed && item.accent && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em]",
                        active ? "bg-gold-400/15 text-gold-400" : "bg-gold-500/10 text-gold-500",
                      )}
                    >
                      Scan
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
