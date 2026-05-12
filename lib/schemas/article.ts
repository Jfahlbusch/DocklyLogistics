import { z } from "zod";
import { registry } from "@/lib/api/openapi";

export const UnitKindSchema = z.enum([
  "PIECE", "KG", "G", "L", "ML", "PACK", "SACK", "BOX", "PALLET", "OTHER",
]);

export const BarcodeSourceSchema = z.enum(["SKU", "EAN"]);

export const ArticleCreateSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  shortDesc: z.string().max(500).optional(),
  longDesc: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  eanGtin: z.string().regex(/^\d{8,14}$/).optional(),
  baseUnit: UnitKindSchema,
  orderUnit: UnitKindSchema,
  packFactor: z.number().int().min(1),
  barcodeSource: BarcodeSourceSchema.default("SKU"),
  minStock: z.number().int().min(0).default(0),
  defaultLocationId: z.string().cuid().optional(),
  vatRate: z.number().min(0).max(100).optional(),
}).openapi("ArticleCreate");

export const ArticleUpdateSchema = ArticleCreateSchema.partial().openapi("ArticleUpdate");

export const ArticleListQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  supplierId: z.string().cuid().optional(),
  belowMin: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});

export const ArticleSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  sku: z.string(),
  name: z.string(),
  shortDesc: z.string().nullable(),
  longDesc: z.string().nullable(),
  category: z.string().nullable(),
  eanGtin: z.string().nullable(),
  baseUnit: UnitKindSchema,
  orderUnit: UnitKindSchema,
  packFactor: z.number(),
  barcodeSource: BarcodeSourceSchema,
  minStock: z.number(),
  defaultLocationId: z.string().nullable(),
  vatRate: z.string().nullable(), // Prisma Decimal returns as string
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).openapi("Article");

export type ArticleCreate = z.infer<typeof ArticleCreateSchema>;
export type ArticleUpdate = z.infer<typeof ArticleUpdateSchema>;

// Register tag once
registry.registerPath({
  method: "get",
  path: "/articles",
  summary: "Artikel auflisten",
  tags: ["Articles"],
  request: {
    query: ArticleListQuerySchema,
  },
  responses: {
    200: {
      description: "Liste von Artikeln (paginiert)",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(ArticleSchema),
            meta: z.object({
              page: z.number(),
              pageSize: z.number(),
              total: z.number(),
            }),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/articles",
  summary: "Artikel anlegen",
  tags: ["Articles"],
  request: {
    body: { content: { "application/json": { schema: ArticleCreateSchema } } },
  },
  responses: {
    201: { description: "Artikel angelegt", content: { "application/json": { schema: z.object({ data: ArticleSchema }) } } },
    422: { description: "Validierungsfehler" },
  },
});

registry.registerPath({
  method: "get",
  path: "/articles/{id}",
  summary: "Artikel-Detail",
  tags: ["Articles"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: {
    200: { description: "Artikel-Detail", content: { "application/json": { schema: z.object({ data: ArticleSchema }) } } },
    404: { description: "Nicht gefunden" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/articles/{id}",
  summary: "Artikel aktualisieren",
  tags: ["Articles"],
  request: {
    params: z.object({ id: z.string().cuid() }),
    body: { content: { "application/json": { schema: ArticleUpdateSchema } } },
  },
  responses: {
    200: { description: "Aktualisiert" },
    404: { description: "Nicht gefunden" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/articles/{id}",
  summary: "Artikel löschen",
  tags: ["Articles"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: {
    204: { description: "Gelöscht" },
    404: { description: "Nicht gefunden" },
  },
});
