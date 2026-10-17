export type ScanResult = { kind: "zone"; zoneId: string } | { kind: "code"; code: string };

const WALK_PATH = "/warehouse-mode";
const ZONE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Ordnet ein Scan-/Eingabeergebnis ein: Zonen-QR (An-B8) oder Artikelcode. Reine Funktion.
 * Als Zone gilt NUR eine absolute http(s)-URL mit exakt dem Origin der App (Schema + Host + Port),
 * Pfad `/warehouse-mode` und gültiger `zone`-ID — alles andere (fremder Host, `javascript:`,
 * relative Pfade, kaputte URLs) ist ein normaler Code und wird nie als Ziel verwendet.
 * Das Ziel baut der Aufrufer aus der ID selbst (`/warehouse-mode?zone=<id>`), nie aus der gescannten URL.
 */
export function parseScan(raw: string, currentOrigin: string): ScanResult {
  const code = raw.trim();
  const fallback: ScanResult = { kind: "code", code };
  let url: URL;
  let origin: string;
  try {
    url = new URL(code);
    origin = new URL(currentOrigin).origin;
  } catch {
    return fallback;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
  if (url.origin !== origin) return fallback;
  if (url.pathname !== WALK_PATH && url.pathname !== `${WALK_PATH}/`) return fallback;
  const zoneId = url.searchParams.get("zone") ?? "";
  if (!ZONE_ID.test(zoneId)) return fallback;
  return { kind: "zone", zoneId };
}
