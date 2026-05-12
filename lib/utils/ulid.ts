/**
 * Tiny ULID-like generator (timestamp + random). Sufficient for correlating
 * StockMovement transfer pairs and similar IDs. Not cryptographically random.
 */
export function ulid(): string {
  const ts = Date.now().toString(36).padStart(10, "0");
  const rand = Math.random().toString(36).slice(2, 14).padEnd(12, "0");
  return (ts + rand).toUpperCase();
}
