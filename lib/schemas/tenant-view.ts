import { z } from "zod";
import { registry } from "@/lib/api/openapi";

export const TenantViewSetSchema = z
  .object({ tenantId: z.string().trim().min(1).max(64) })
  .openapi("TenantViewSet");

export type TenantViewSet = z.infer<typeof TenantViewSetSchema>;

registry.registerPath({
  method: "put",
  path: "/me/tenant-view",
  summary: "Fremden Mandanten betrachten (GLOBAL_ADMIN) — setzt das Session-Cookie admin_view_tenant",
  description:
    "Der Wechsel gilt lesend und schreibend für die komplette App, bis das Browser-Fenster schließt " +
    "oder die Ansicht per DELETE beendet wird. Wird im Ziel-Mandanten auditiert (Entity AdminTenantView).",
  tags: ["Admin"],
  request: { body: { content: { "application/json": { schema: TenantViewSetSchema } } } },
  responses: {
    200: { description: "Cookie gesetzt; { tenant: { id, name } }" },
    403: { description: "Nur GLOBAL_ADMIN" },
    404: { description: "Mandant unbekannt (kein Cookie gesetzt)" },
    422: { description: "Ungültiger Body" },
  },
});
registry.registerPath({
  method: "delete",
  path: "/me/tenant-view",
  summary: "Mandanten-Ansicht beenden (GLOBAL_ADMIN) — löscht das Cookie, zurück zum eigenen Mandanten",
  tags: ["Admin"],
  responses: { 204: { description: "Cookie gelöscht" }, 403: { description: "Nur GLOBAL_ADMIN" } },
});

/**
 * Daten der Unternehmenskarte im Menü (Vorlage `assets/layout`). `tenants` ist nur für GLOBAL_ADMIN gesetzt — dann ist die Karte der
 * Auslöser des Wechslers; sonst bleibt sie eine statische Anzeige (kein Mandantennamen-Leak an andere Rollen).
 */
export type TenantNavigation = {
  /** Wirksamer Mandant (bei Fremdansicht der betrachtete). */
  currentTenant: string;
  /** Echter Mandant des Angemeldeten. */
  homeTenant: string;
  currentName: string;
  tenants?: { id: string; name: string }[];
};
