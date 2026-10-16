"use client";

import { useEffect, useState } from "react";
import { SCROLL_THRESHOLD, SCROLL_TOP_ZONE, nextMinimized } from "@/lib/scroll-direction";

/**
 * Liefert `true`, solange der Scrollcontainer `#<elementId>` nach unten gescrollt wird
 * (Pill minimiert), und `false` beim Hochscrollen bzw. nahe dem Anfang.
 * Der Referenzpunkt wandert erst weiter, wenn die Schwelle überschritten ist — so
 * minimiert auch langsames Scrollen in kleinen Schritten.
 */
export function useScrollMinimized(elementId: string): boolean {
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    const el = document.getElementById(elementId);
    if (!el) return;
    let anchor = el.scrollTop;
    let current = false;

    const onScroll = () => {
      const top = el.scrollTop;
      const next = nextMinimized(anchor, top, current);
      if (next !== current) {
        current = next;
        setMinimized(next);
      }
      if (Math.abs(top - anchor) > SCROLL_THRESHOLD || top < SCROLL_TOP_ZONE) anchor = top;
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [elementId]);

  return minimized;
}
