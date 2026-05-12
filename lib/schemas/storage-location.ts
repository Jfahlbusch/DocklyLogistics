import { z } from "zod";
import { registry } from "@/lib/api/openapi";

export const StorageLocationCreateSchema = z.object({
  code: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  zone: z.string().max(80).optional(),
  bin: z.string().max(40).optional(),
  capacity: z.number().int().min(0).optional(),
  active: z.boolean().default(true),
}).openapi("StorageLocationCreate");

export const StorageLocationUpdateSchema = StorageLocationCreateSchema.partial().openapi("StorageLocationUpdate");

export const StorageLocationListQuerySchema = z.object({
  q: z.string().optional(),
  zone: z.string().optional(),
  active: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});

export type StorageLocationCreate = z.infer<typeof StorageLocationCreateSchema>;
export type StorageLocationUpdate = z.infer<typeof StorageLocationUpdateSchema>;

registry.registerPath({
  method: "get", path: "/locations", summary: "Lagerplätze auflisten", tags: ["Locations"],
  request: { query: StorageLocationListQuerySchema },
  responses: { 200: { description: "Liste" } },
});
registry.registerPath({
  method: "post", path: "/locations", summary: "Lagerplatz anlegen", tags: ["Locations"],
  request: { body: { content: { "application/json": { schema: StorageLocationCreateSchema } } } },
  responses: { 201: { description: "Angelegt" }, 409: { description: "Code existiert" }, 422: { description: "Validierungsfehler" } },
});
registry.registerPath({
  method: "get", path: "/locations/{id}", summary: "Lagerplatz-Detail", tags: ["Locations"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 200: { description: "OK" }, 404: { description: "Nicht gefunden" } },
});
registry.registerPath({
  method: "patch", path: "/locations/{id}", summary: "Lagerplatz aktualisieren", tags: ["Locations"],
  request: { params: z.object({ id: z.string().cuid() }), body: { content: { "application/json": { schema: StorageLocationUpdateSchema } } } },
  responses: { 200: { description: "Aktualisiert" }, 404: { description: "Nicht gefunden" } },
});
registry.registerPath({
  method: "delete", path: "/locations/{id}", summary: "Lagerplatz löschen", tags: ["Locations"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 204: { description: "Gelöscht" }, 404: { description: "Nicht gefunden" } },
});
