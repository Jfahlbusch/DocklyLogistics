/**
 * Offline-Queue für Lagermodus-Scans.
 *
 * Wenn der Browser offline ist oder ein API-Lookup fehlschlägt, werden Scans
 * lokal (localStorage) zwischengespeichert und können später per Knopfdruck
 * (`flushOfflineQueue`) erneut verarbeitet werden.
 */

export type OfflineEntry =
  | { type: "SCAN"; code: string; timestamp: number };

const STORAGE_KEY = "docklylogistics:offline-queue";

function read(): OfflineEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OfflineEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: OfflineEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function addToOfflineQueue(entry: OfflineEntry): void {
  const q = read();
  q.push(entry);
  write(q);
}

export function getOfflineQueueSize(): number {
  return read().length;
}

export function clearOfflineQueue(): void {
  write([]);
}

/**
 * Flush queued entries through the supplied handler.
 *
 * Handler returns `true` when the entry was processed and should be removed
 * from the queue; `false` keeps the entry pending for the next flush.
 */
export async function flushOfflineQueue(
  handler: (entry: OfflineEntry) => boolean | Promise<boolean>,
): Promise<number> {
  const q = read();
  const remaining: OfflineEntry[] = [];
  let flushed = 0;
  for (const entry of q) {
    const ok = await handler(entry);
    if (ok) flushed++;
    else remaining.push(entry);
  }
  write(remaining);
  return flushed;
}
