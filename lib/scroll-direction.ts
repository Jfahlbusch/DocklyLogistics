/** Scroll-Schwelle in px: kleinere Bewegungen (Zittern, Trackpad-Rauschen) ändern nichts. */
export const SCROLL_THRESHOLD = 8;
/** Bis zu dieser Scrollposition (px) bleibt die Tab-Pill immer voll sichtbar. */
export const SCROLL_TOP_ZONE = 48;

/**
 * Reiner Übergang für die Pill-Minimierung.
 * runter > threshold und top > 48 → minimiert; hoch > threshold oder top < 48 → normal;
 * sonst unverändert.
 */
export function nextMinimized(
  prevTop: number,
  top: number,
  minimized: boolean,
  threshold: number = SCROLL_THRESHOLD,
): boolean {
  if (top < SCROLL_TOP_ZONE) return false;
  const delta = top - prevTop;
  if (delta > threshold && top > SCROLL_TOP_ZONE) return true;
  if (delta < -threshold) return false;
  return minimized;
}
