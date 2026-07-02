import { z } from "zod";
import { registry } from "@/lib/api/openapi";

/* Operator administration (GLOBAL_ADMIN): tenant feature gates + profiles. */

export const AdminTenantFeaturesUpdateSchema = z.object({
  /** featureKey → true/false sets an operator override; null clears it. */
  features: z.record(z.string(), z.boolean().nullable()).optional(),
  /** Assign (id) or unassign (null) a feature profile; omit to keep. */
  profileId: z.string().cuid().nullable().optional(),
}).openapi("AdminTenantFeaturesUpdate");

export const FeatureProfileCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  /** featureKey → enabled. Missing keys mean "available" (default on). */
  features: z.record(z.string(), z.boolean()).default({}),
}).openapi("FeatureProfileCreate");

export const FeatureProfileUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  features: z.record(z.string(), z.boolean()).optional(),
}).openapi("FeatureProfileUpdate");

export type AdminTenantFeaturesUpdate = z.infer<typeof AdminTenantFeaturesUpdateSchema>;
export type FeatureProfileCreate = z.infer<typeof FeatureProfileCreateSchema>;
export type FeatureProfileUpdate = z.infer<typeof FeatureProfileUpdateSchema>;

// OpenAPI registration — the /admin surface is the sanctioned cross-tenant
// exception; every endpoint requires GLOBAL_ADMIN.
registry.registerPath({
  method: "get", path: "/admin/tenants", summary: "Alle Tenants mit Profil & Sperren (Betreiber)", tags: ["Admin"],
  responses: { 200: { description: "Liste" }, 403: { description: "Nur GLOBAL_ADMIN" } },
});
registry.registerPath({
  method: "get", path: "/admin/tenants/{id}/features", summary: "Funktions-Gate eines Tenants", tags: ["Admin"],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: "Gate + Overrides + Profil" }, 404: { description: "Tenant unbekannt" } },
});
registry.registerPath({
  method: "put", path: "/admin/tenants/{id}/features", summary: "Funktions-Gate/Profil eines Tenants setzen", tags: ["Admin"],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: AdminTenantFeaturesUpdateSchema } } },
  },
  responses: { 200: { description: "Aktualisiert" }, 404: { description: "Tenant/Profil unbekannt" } },
});
registry.registerPath({
  method: "get", path: "/admin/feature-profiles", summary: "Funktionsprofile auflisten", tags: ["Admin"],
  responses: { 200: { description: "Liste inkl. Verwendungszahl" } },
});
registry.registerPath({
  method: "post", path: "/admin/feature-profiles", summary: "Funktionsprofil anlegen", tags: ["Admin"],
  request: { body: { content: { "application/json": { schema: FeatureProfileCreateSchema } } } },
  responses: { 201: { description: "Angelegt" }, 409: { description: "Name existiert" } },
});
registry.registerPath({
  method: "patch", path: "/admin/feature-profiles/{id}", summary: "Funktionsprofil ändern", tags: ["Admin"],
  request: {
    params: z.object({ id: z.string().cuid() }),
    body: { content: { "application/json": { schema: FeatureProfileUpdateSchema } } },
  },
  responses: { 200: { description: "Aktualisiert" }, 404: { description: "Nicht gefunden" } },
});
registry.registerPath({
  method: "delete", path: "/admin/feature-profiles/{id}", summary: "Funktionsprofil löschen", tags: ["Admin"],
  description: "Zugeordnete Tenants fallen auf „alles verfügbar“ zurück (SetNull).",
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 204: { description: "Gelöscht" }, 404: { description: "Nicht gefunden" } },
});
