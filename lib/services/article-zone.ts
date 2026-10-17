import { zoneRepo } from "@/lib/db/repos/zone";
import { storageLocationRepo } from "@/lib/db/repos/storage-location";

export type ZoneFieldError = { field: string; message: string };

/**
 * Prüft Zone und Standard-Lagerplatz eines Artikels gegeneinander (nach dem Zusammenführen mit den
 * gespeicherten Werten) und liefert die wirksame Zone. Ein Lagerplatz mit Zone setzt die Zone,
 * wenn keine gewählt ist. `zoneId: null` heißt „keine Zone“, `undefined` „nicht angegeben“.
 */
export async function resolveArticleZone(
  tenantId: string,
  input: { zoneId?: string | null; defaultLocationId?: string | null },
): Promise<{ zoneId: string | null | undefined; errors: ZoneFieldError[] }> {
  const errors: ZoneFieldError[] = [];
  let zoneId = input.zoneId;

  if (zoneId && !(await zoneRepo.existsInTenant(tenantId, zoneId))) {
    errors.push({ field: "zoneId", message: "Zone nicht gefunden" });
    return { zoneId, errors };
  }

  if (input.defaultLocationId) {
    const loc = await storageLocationRepo.findById(tenantId, input.defaultLocationId);
    if (!loc) {
      errors.push({ field: "defaultLocationId", message: "Lagerplatz nicht gefunden" });
    } else if (loc.zoneId) {
      if (!zoneId) zoneId = loc.zoneId;
      else if (loc.zoneId !== zoneId) {
        errors.push({ field: "defaultLocationId", message: "Lagerplatz gehört zu einer anderen Zone" });
      }
    }
  }
  return { zoneId, errors };
}
