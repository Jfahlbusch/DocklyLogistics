"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
import { Brand } from "./brand";
import { cn } from "@/lib/utils";

type Props = {
  user: { name: string; role: string; tenant: string };
};

export function Sidebar({ user }: Props) {
  const pathname = usePathname();
  return (
    <aside className="app-sidebar hidden md:flex md:flex-col w-[260px] flex-shrink-0">
      <Brand />
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-md border-l-2 px-4 py-2.5 text-sm transition-colors",
                active
                  ? "border-gold-500 bg-white/10 font-medium text-white"
                  : "border-transparent font-normal text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon
                size={18}
                strokeWidth={1.5}
                className={cn(
                  "shrink-0",
                  active ? "text-gold-400" : item.accent ? "text-gold-500" : "text-white/60",
                )}
              />
              <span className="flex-1">{item.label}</span>
              {item.accent && (
                <span
                  className={cn(
                    "text-[10px] tracking-[0.16em] uppercase",
                    active ? "text-gold-400" : "text-gold-500",
                  )}
                >
                  Scan
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-5 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-white/10 text-white font-medium flex items-center justify-center text-xs">
          {user.name
            .split(" ")
            .map((s) => s[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div className="min-w-0">
          <div className="font-medium text-sm truncate text-white">{user.name}</div>
          <div className="text-xs text-white/50 truncate">
            {user.role} · {user.tenant}
          </div>
        </div>
      </div>
    </aside>
  );
}
