"use client";

import { usePathname } from "next/navigation";
import { Search, Bell } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";

export function Topbar() {
  const pathname = usePathname();
  const current = NAV_ITEMS.find((n) => pathname.startsWith(n.href));
  return (
    <header className="sticky top-0 z-10 bg-white/85 backdrop-blur border-b border-stone-200">
      <div className="flex items-center gap-3 px-4 md:px-8 h-14">
        <div className="text-sm text-stone-500">
          <span className="text-stone-300">DocklyLogistics</span>
          <span className="mx-2">/</span>
          <b className="text-stone-700 font-medium">{current?.label ?? "Übersicht"}</b>
        </div>
        <div className="flex-1" />
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 border border-stone-200 rounded-lg text-stone-500 text-xs w-60 bg-white">
          <Search size={14} />
          <span>Suchen (Strg+K)</span>
        </div>
        <button className="relative p-2 rounded-lg hover:bg-stone-100 text-stone-700">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-gold-500" />
        </button>
      </div>
    </header>
  );
}
