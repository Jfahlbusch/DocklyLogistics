"use client";

import * as React from "react";

/**
 * Beobachtet eine Media-Query ohne Effekt-Zustand (`useSyncExternalStore`). Auf dem Server und vor der
 * Hydration gilt `serverValue`. Gedacht für Verhalten, das CSS allein nicht ausdrücken kann (z. B. die
 * Seite eines Sheets); reines Layout bleibt bei Tailwind-Breakpoints.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** Breakpoint `md` von Tailwind (768 px): ab hier Desktop-Verhalten. */
export const MD_QUERY = "(min-width: 768px)";
