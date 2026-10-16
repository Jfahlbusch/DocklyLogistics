"use client";

import { useEffect, useState } from "react";

/**
 * `true`, solange der Nutzer nach unten scrollt (und nicht mehr am Seitenanfang ist) — die Tab-Bar
 * minimiert sich dann; beim Hochscrollen oder am Seitenanfang wird sie wieder groß. Kleine Bewegungen
 * unter `threshold` px ändern nichts (kein Flackern).
 */
export function useScrollingDown({ threshold = 12, topOffset = 64 } = {}): boolean {
  const [down, setDown] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      // `lastY` nur nach einem Richtungswechsel über der Schwelle fortschreiben: Ein langsames
      // Scrollen in kleinen Schritten (< threshold je Event) summiert sich sonst nie auf.
      if (y <= topOffset) {
        setDown(false);
        lastY = y;
      } else if (Math.abs(y - lastY) >= threshold) {
        setDown(y > lastY);
        lastY = y;
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold, topOffset]);

  return down;
}
