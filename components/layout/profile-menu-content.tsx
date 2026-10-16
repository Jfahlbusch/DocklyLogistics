"use client";

import { useRef, type ComponentProps } from "react";
import { LogOut } from "lucide-react";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { roleLabel } from "@/lib/user-display";
import { logoutAction } from "./profile-actions";

export type ProfilUser = { name: string; email?: string; role: string; tenant: string };

/** Leert alle Service-Worker-Caches, damit nach dem Abmelden keine Mandantendaten im Cache bleiben. */
async function clearCaches() {
  try {
    if ("caches" in window) {
      await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
    }
  } catch {
    /* Abmelden darf an der Cache-API nie scheitern */
  }
}

/**
 * Menüinhalt des Profilbuttons (eine Quelle für beide Auslöser: Topbar-Avatar
 * und Sidebar-Fuß). Muss innerhalb eines `DropdownMenu` stehen; Ausrichtung
 * (`side`/`align`) legt der jeweilige Auslöser fest.
 */
export function ProfileMenuContent({
  user,
  className,
  ...props
}: { user: ProfilUser } & Omit<ComponentProps<typeof DropdownMenuContent>, "children">) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <DropdownMenuContent className={`w-64 ${className ?? ""}`.trim()} {...props}>
      <DropdownMenuLabel className="px-2 py-2 font-normal">
        <div className="truncate text-sm font-medium text-foreground">{user.name}</div>
        {user.email && (
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
        )}
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <span>{roleLabel(user.role)}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate rounded bg-muted px-1.5 font-mono text-[11px]">
            {user.tenant}
          </span>
        </div>
      </DropdownMenuLabel>

      <DropdownMenuSeparator />

      {/* Kein Menü-Item: Klicks/Pfeiltasten im Umschalter dürfen das Menü weder
          schließen noch als Menüauswahl zählen. Escape greift über Radix
          (Dokument-Listener) weiterhin. */}
      <div className="px-2 py-1.5" onKeyDown={(e) => e.stopPropagation()}>
        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Farbschema
        </div>
        <ThemeToggle />
      </div>

      <DropdownMenuSeparator />

      <form ref={formRef} action={logoutAction} role="none">
        <DropdownMenuItem
          variant="destructive"
          className="px-2 py-2"
          asChild
          onSelect={async (e) => {
            // Menü offen lassen, bis der Submit ausgelöst ist (Formular liegt im Portal).
            e.preventDefault();
            await clearCaches();
            formRef.current?.requestSubmit();
          }}
        >
          <button type="button" className="w-full">
            <LogOut size={16} strokeWidth={1.5} />
            Abmelden
          </button>
        </DropdownMenuItem>
      </form>
    </DropdownMenuContent>
  );
}
