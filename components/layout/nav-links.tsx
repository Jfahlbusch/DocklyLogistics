"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

/** The teal sidebar navigation list. Shared by the desktop Sidebar and the mobile drawer. */
export function NavLinks({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-md border-l-2 py-2.5 text-sm transition-colors",
              collapsed ? "justify-center px-0" : "px-4",
              active
                ? "border-gold-500 bg-white/10 font-medium text-white"
                : "border-transparent font-normal text-white/70 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon
              size={18}
              strokeWidth={1.5}
              className={cn("shrink-0", active ? "text-gold-400" : item.accent ? "text-gold-500" : "text-white/60")}
            />
            {!collapsed && <span className="flex-1">{item.label}</span>}
            {!collapsed && item.accent && (
              <span className={cn("text-[10px] uppercase tracking-[0.16em]", active ? "text-gold-400" : "text-gold-500")}>
                Scan
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
