"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { logoutAction } from "./profile-actions";

type Props = {
  user: { name: string; email?: string; role: string; tenant: string };
};

/** Profilbereich (Header-Dropdown) aus dem Referenzprojekt: Nutzerinfo +
 *  Farbschema-Umschalter (Hell/Dunkel/System) + Abmelden. */
export function ProfileMenu({ user }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const initials =
    user.name
      .split(" ")
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Profil & Einstellungen"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-xs font-medium text-white dark:bg-gold-500 dark:text-navy-900 transition-opacity hover:opacity-90"
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="px-3 py-2.5">
            <div className="truncate text-sm font-medium text-foreground">{user.name}</div>
            {user.email && (
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            )}
            <div className="mt-1 text-xs text-muted-foreground">
              {user.role} · {user.tenant}
            </div>
          </div>

          <div className="border-t border-border px-3 py-2.5">
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Farbschema
            </div>
            <ThemeToggle />
          </div>

          <div className="border-t border-border p-1">
            <form action={logoutAction}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-muted"
              >
                <LogOut size={16} strokeWidth={1.5} />
                Abmelden
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
