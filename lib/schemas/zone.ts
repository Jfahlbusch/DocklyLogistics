import { z } from "zod";
import { registry } from "@/lib/api/openapi";

export const ZoneCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(-100000).max(100000).optional(),
  active: z.boolean().optional(),
}).openapi("ZoneCreate");

export const ZoneUpdateSchema = ZoneCreateSchema.partial().openapi("ZoneUpdate");

export type ZoneCreate = z.infer<typeof ZoneCreateSchema>;
export type ZoneUpdate = z.infer<typeof ZoneUpdateSchema>;

/** Zonen-IDs sind cuid (neu angelegt) oder `z`+32 Hex (Datenmigration) — daher keine cuid-Prüfung. */
export const ZoneIdSchema = z.string().min(1).max(64);

registry.registerPath({
  method: "get", path: "/zones", summary: "Zonen auflisten (mit Zählern locationCount/articleCount)", tags: ["Zones"],
  responses: { 200: { description: "Liste, sortiert nach sortOrder, name" } },
});
registry.registerPath({
  method: "post", path: "/zones", summary: "Zone anlegen", tags: ["Zones"],
  request: { body: { content: { "application/json": { schema: ZoneCreateSchema } } } },
  responses: { 201: { description: "Angelegt" }, 409: { description: "Name existiert im Mandanten" }, 422: { description: "Validierungsfehler" } },
});
registry.registerPath({
  method: "get", path: "/zones/{id}", summary: "Zonen-Detail", tags: ["Zones"],
  request: { params: z.object({ id: ZoneIdSchema }) },
  responses: { 200: { description: "OK" }, 404: { description: "Nicht gefunden" } },
});
registry.registerPath({
  method: "patch", path: "/zones/{id}", summary: "Zone aktualisieren", tags: ["Zones"],
  request: { params: z.object({ id: ZoneIdSchema }), body: { content: { "application/json": { schema: ZoneUpdateSchema } } } },
  responses: { 200: { description: "Aktualisiert" }, 404: { description: "Nicht gefunden" }, 409: { description: "Name existiert im Mandanten" }, 422: { description: "Validierungsfehler" } },
});
registry.registerPath({
  method: "delete", path: "/zones/{id}", summary: "Zone löschen", tags: ["Zones"],
  request: { params: z.object({ id: ZoneIdSchema }) },
  responses: { 204: { description: "Gelöscht" }, 404: { description: "Nicht gefunden" }, 409: { description: "Zone ist Lagerplätzen oder Artikeln zugeordnet" } },
});
