import { z } from "zod";
import { registry } from "@/lib/api/openapi";

export const UnitKindSchema = z.enum([
  "PIECE", "KG", "G", "L", "ML", "PACK", "SACK", "BOX", "PALLET", "OTHER",
]);

export const BarcodeSourceSchema = z.enum(["SKU", "EAN"]);

// Basis ohne Defaults: `.partial()` würde unter Zod 4 Defaults sonst im Update anwenden
// (ein PATCH {name} setzte minStock auf 0 und barcodeSource auf SKU zurück).
const ArticleBaseSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  shortDesc: z.string().max(500).optional(),
  longDesc: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  eanGtin: z.string().regex(/^\d{8,14}$/).optional(),
  baseUnit: UnitKindSchema,
  orderUnit: UnitKindSchema,
  packFactor: z.number().int().min(1),
  barcodeSource: BarcodeSourceSchema,
  minStock: z.number().int().min(0),
  maxStock: z.number().int().min(0).nullable().optional(),
  targetStock: z.number().int().min(0).nullable().optional(),
  defaultLocationId: z.string().cuid().nullable().optional(),
  // Bewusst kein cuid(): die Zugehörigkeit zum Mandanten prüft die Route (422 am Feld zoneId).
  zoneId: z.string().min(1).max(64).nullable().optional(),
  vatRate: z.number().min(0).max(100).optional(),
});

export const ArticleCreateSchema = ArticleBaseSchema.extend({
  barcodeSource: BarcodeSourceSchema.default("SKU"),
  minStock: z.number().int().min(0).default(0),
}).openapi("ArticleCreate");

export const ArticleUpdateSchema = ArticleBaseSchema.partial().openapi("ArticleUpdate");

export const ArticleListQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  supplierId: z.string().cuid().optional(),
  zoneId: z.string().min(1).max(64).optional(),
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
  maxStock: z.number().nullable(),
  targetStock: z.number().nullable(),
  defaultLocationId: z.string().nullable(),
  zoneId: z.string().nullable(),
  zone: z.object({ id: z.string(), name: z.string() }).nullable(),
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
  summary: "Artikel auflisten (optional nach Zone gefiltert: `zoneId`)",
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
    422: { description: "Validierungsfehler (u. a. Mindestmenge ≤ empfohlene Menge ≤ Maximalmenge; `zoneId` muss eine Zone des Mandanten sein; `defaultLocationId` muss ein Lagerplatz des Mandanten sein und zur Zone passen; Feldfehler unter `errors`). Ohne `zoneId` übernimmt der Artikel die Zone des Standard-Lagerplatzes." },
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
    422: { description: "Validierungsfehler. `maxStock`/`targetStock`: `null` löscht den Wert; Teil-Updates werden gegen die gespeicherten Werte geprüft (Mindestmenge ≤ empfohlene Menge ≤ Maximalmenge). `zoneId`: `null` löscht die Zone; Zone und Standard-Lagerplatz müssen zusammenpassen, ein Lagerplatz mit Zone setzt die Zone automatisch, wenn keine angegeben ist. Feldfehler unter `errors`." },
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

registry.registerPath({
  method: "post", path: "/articles/{id}/barcode", summary: "Barcode generieren", tags: ["Articles"],
  request: {
    params: z.object({ id: z.string().cuid() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            format: z.enum(["code128", "ean13"]),
            source: z.enum(["SKU", "EAN"]).default("SKU"),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "Barcode generiert (SVG + Base64-PNG)" },
    404: { description: "Artikel nicht gefunden" },
    422: { description: "Generierung fehlgeschlagen" },
  },
});
