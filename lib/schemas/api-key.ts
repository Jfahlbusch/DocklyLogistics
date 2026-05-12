import { z } from "zod";
import { registry } from "@/lib/api/openapi";

export const ApiScopeSchema = z.enum(["orders:read", "orders:confirm", "deliveries:write"]);

export const ApiKeyCreateSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  scopes: z.array(ApiScopeSchema).min(1),
  expiresAt: z.string().datetime().optional(),
}).openapi("ApiKeyCreate");

export type ApiKeyCreate = z.infer<typeof ApiKeyCreateSchema>;

registry.registerPath({
  method: "get", path: "/suppliers/{id}/api-keys", summary: "API-Keys eines Lieferanten", tags: ["ApiKeys"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 200: { description: "Liste (ohne Secrets)" }, 404: { description: "Lieferant nicht gefunden" } },
});
registry.registerPath({
  method: "post", path: "/suppliers/{id}/api-keys", summary: "API-Key anlegen", tags: ["ApiKeys"],
  request: { params: z.object({ id: z.string().cuid() }), body: { content: { "application/json": { schema: ApiKeyCreateSchema } } } },
  responses: { 201: { description: "Angelegt (fullKey nur in dieser Antwort sichtbar)" } },
});
registry.registerPath({
  method: "delete", path: "/suppliers/{id}/api-keys/{keyId}", summary: "API-Key widerrufen", tags: ["ApiKeys"],
  request: { params: z.object({ id: z.string().cuid(), keyId: z.string().cuid() }) },
  responses: { 204: { description: "Widerrufen" }, 404: { description: "Nicht gefunden" } },
});
