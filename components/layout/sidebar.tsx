"use client";

import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Brand } from "./brand";
import { NavLinks } from "./nav-links";
import { SidebarUser } from "./sidebar-user";
import { cn } from "@/lib/utils";

type Props = {
  user: { name: string; role: string; tenant: string };
};

export function Sidebar({ user }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "1");
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "app-sidebar hidden flex-shrink-0 transition-[width] duration-200 md:flex md:flex-col",
        collapsed ? "w-[68px]" : "w-[260px]",
      )}
    >
      <Brand collapsed={collapsed} />
      <NavLinks collapsed={collapsed} />
      <SidebarUser user={user} collapsed={collapsed} />
      <button
        type="button"
        onClick={toggle}
        title={collapsed ? "Menü ausklappen" : "Menü einklappen"}
        aria-label={collapsed ? "Menü ausklappen" : "Menü einklappen"}
        className="flex items-center justify-center gap-2 border-t border-white/10 py-3 text-xs text-white/60 transition-colors hover:bg-white/5 hover:text-white"
      >
        {collapsed ? (
          <PanelLeftOpen size={18} strokeWidth={1.5} />
        ) : (
          <>
            <PanelLeftClose size={18} strokeWidth={1.5} />
            <span>Einklappen</span>
          </>
        )}
      </button>
    </aside>
  );
}
