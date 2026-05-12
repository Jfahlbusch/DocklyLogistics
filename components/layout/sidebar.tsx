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
    <aside className="hidden md:flex md:flex-col w-[260px] flex-shrink-0 bg-white border-r border-stone-200">
      <Brand />
      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-navy-900 text-white"
                  : "text-stone-700 hover:bg-stone-100",
              )}
            >
              <Icon
                size={18}
                className={cn(
                  active ? "text-gold-400" : item.accent ? "text-gold-500" : "text-stone-500",
                )}
              />
              <span className="flex-1">{item.label}</span>
              {item.accent && (
                <span className={cn("text-[10px] tracking-[0.16em] uppercase", active ? "text-gold-400" : "text-gold-500")}>
                  Scan
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-stone-200 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-navy-100 text-navy-900 font-medium flex items-center justify-center">
          {user.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
        </div>
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{user.name}</div>
          <div className="text-xs text-stone-500 truncate">
            {user.role} · {user.tenant}
          </div>
        </div>
      </div>
    </aside>
  );
}
