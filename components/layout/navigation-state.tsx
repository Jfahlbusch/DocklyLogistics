"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { NavArea } from "@/lib/navigation";
import { DEFAULT_OPEN_AREAS, writeNavigationPreference, type OpenNavigationAreas } from "@/lib/navigation-preference";

const NavigationState = createContext<{ open: OpenNavigationAreas; toggle: (area: NavArea) => void } | null>(null);

/** Sidebar und Drawer teilen die Präferenz; Seitenwechsel und Drawer-Schließen setzen sie nicht zurück. */
export function NavigationStateProvider({ initialOpen = DEFAULT_OPEN_AREAS, children }: { initialOpen?: OpenNavigationAreas; children: ReactNode }) {
  const [open, setOpen] = useState(initialOpen);
  function toggle(area: NavArea) {
    const next = { ...open, [area]: !open[area] };
    setOpen(next);
    writeNavigationPreference(next);
  }
  return <NavigationState.Provider value={{ open, toggle }}>{children}</NavigationState.Provider>;
}

export function useNavigationState() {
  const state = useContext(NavigationState);
  if (!state) throw new Error("NavigationStateProvider fehlt");
  return state;
}
