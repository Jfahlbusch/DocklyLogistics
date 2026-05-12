import { z } from "zod";
import { registry } from "@/lib/api/openapi";

export const SupplierChannelSchema = z.enum(["EMAIL", "API", "EDI"]);

// Recipient-side channel config (per supplier — different from TenantChannelConfig)
// In M2 we accept any JSON; tightening per channel comes in M4 when dispatch logic uses it.
export const SupplierChannelConfigSchema = z.record(z.string(), z.unknown());

export const SupplierCreateSchema = z.object({
  name: z.string().min(1).max(200),
  contactName: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(60).optional(),
  street: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(80).optional(),
  channel: SupplierChannelSchema.default("EMAIL"),
  channelConfig: SupplierChannelConfigSchema.default({}),
  active: z.boolean().default(true),
}).openapi("SupplierCreate");

export const SupplierUpdateSchema = SupplierCreateSchema.partial().openapi("SupplierUpdate");

export const SupplierListQuerySchema = z.object({
  q: z.string().optional(),
  channel: SupplierChannelSchema.optional(),
  active: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});

export const SupplierSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  contactName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  street: z.string().nullable(),
  city: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  channel: SupplierChannelSchema,
  channelConfig: z.unknown(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).openapi("Supplier");

// ArticleSupplier m:n
export const ArticleSupplierCreateSchema = z.object({
  supplierId: z.string().cuid(),
  purchasePrice: z.number().min(0),
  currency: z.string().default("EUR"),
  isPrimary: z.boolean().default(false),
  leadTimeDays: z.number().int().min(0).default(3),
  minOrderQty: z.number().int().min(1).default(1),
  supplierSku: z.string().max(64).optional(),
}).openapi("ArticleSupplierCreate");

export const ArticleSupplierUpdateSchema = ArticleSupplierCreateSchema.partial()
  .omit({ supplierId: true })
  .openapi("ArticleSupplierUpdate");

export type SupplierCreate = z.infer<typeof SupplierCreateSchema>;
export type SupplierUpdate = z.infer<typeof SupplierUpdateSchema>;
export type ArticleSupplierCreate = z.infer<typeof ArticleSupplierCreateSchema>;
export type ArticleSupplierUpdate = z.infer<typeof ArticleSupplierUpdateSchema>;

// OpenAPI registration
registry.registerPath({
  method: "get", path: "/suppliers", summary: "Lieferanten auflisten", tags: ["Suppliers"],
  request: { query: SupplierListQuerySchema },
  responses: { 200: { description: "Liste (paginiert)" } },
});
registry.registerPath({
  method: "post", path: "/suppliers", summary: "Lieferant anlegen", tags: ["Suppliers"],
  request: { body: { content: { "application/json": { schema: SupplierCreateSchema } } } },
  responses: { 201: { description: "Angelegt" }, 409: { description: "Name existiert" }, 422: { description: "Validierungsfehler" } },
});
registry.registerPath({
  method: "get", path: "/suppliers/{id}", summary: "Lieferant-Detail", tags: ["Suppliers"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 200: { description: "OK" }, 404: { description: "Nicht gefunden" } },
});
registry.registerPath({
  method: "patch", path: "/suppliers/{id}", summary: "Lieferant aktualisieren", tags: ["Suppliers"],
  request: { params: z.object({ id: z.string().cuid() }), body: { content: { "application/json": { schema: SupplierUpdateSchema } } } },
  responses: { 200: { description: "Aktualisiert" }, 404: { description: "Nicht gefunden" } },
});
registry.registerPath({
  method: "delete", path: "/suppliers/{id}", summary: "Lieferant löschen", tags: ["Suppliers"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 204: { description: "Gelöscht" }, 404: { description: "Nicht gefunden" } },
});

registry.registerPath({
  method: "get", path: "/articles/{id}/suppliers", summary: "Artikel-Lieferanten-Zuordnungen", tags: ["Articles"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 200: { description: "OK" }, 404: { description: "Artikel nicht gefunden" } },
});
registry.registerPath({
  method: "post", path: "/articles/{id}/suppliers", summary: "Artikel ↔ Lieferant verknüpfen", tags: ["Articles"],
  request: {
    params: z.object({ id: z.string().cuid() }),
    body: { content: { "application/json": { schema: ArticleSupplierCreateSchema } } },
  },
  responses: { 201: { description: "Verknüpft" }, 404: { description: "Artikel oder Lieferant fehlt" }, 409: { description: "Bereits verknüpft" } },
});
registry.registerPath({
  method: "patch", path: "/articles/{articleId}/suppliers/{linkId}", summary: "Zuordnung bearbeiten", tags: ["Articles"],
  request: {
    params: z.object({ articleId: z.string().cuid(), linkId: z.string().cuid() }),
    body: { content: { "application/json": { schema: ArticleSupplierUpdateSchema } } },
  },
  responses: { 200: { description: "Aktualisiert" }, 404: { description: "Nicht gefunden" } },
});
registry.registerPath({
  method: "delete", path: "/articles/{articleId}/suppliers/{linkId}", summary: "Verknüpfung lösen", tags: ["Articles"],
  request: { params: z.object({ articleId: z.string().cuid(), linkId: z.string().cuid() }) },
  responses: { 204: { description: "Gelöst" }, 404: { description: "Nicht gefunden" } },
});
