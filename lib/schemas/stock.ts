import { z } from "zod";
import { registry } from "@/lib/api/openapi";

export const StockAdjustSchema = z.object({
  articleId: z.string().cuid(),
  locationId: z.string().cuid(),
  delta: z.number().int(),         // positive = increase, negative = decrease (but rejected if balance would go below 0)
  reason: z.enum(["CORRECTION", "RECEIPT", "ISSUE", "INVENTORY", "MANUAL"]),
  note: z.string().max(500).optional(),
}).openapi("StockAdjust");

export const StockMoveSchema = z.object({
  articleId: z.string().cuid(),
  fromLocationId: z.string().cuid(),
  toLocationId: z.string().cuid(),
  quantity: z.number().int().min(1),
  note: z.string().max(500).optional(),
}).openapi("StockMove");

export const StockListQuerySchema = z.object({
  articleId: z.string().cuid().optional(),
  locationId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(100),
});

export const StockHistoryQuerySchema = z.object({
  locationId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(100),
});

export type StockAdjustInput = z.infer<typeof StockAdjustSchema>;
export type StockMoveInput = z.infer<typeof StockMoveSchema>;

registry.registerPath({
  method: "get", path: "/stock", summary: "Aktuelle Bestände", tags: ["Stock"],
  request: { query: StockListQuerySchema },
  responses: { 200: { description: "Liste der StockBalance-Einträge" } },
});
registry.registerPath({
  method: "post", path: "/stock/adjust", summary: "Bestand korrigieren", tags: ["Stock"],
  request: { body: { content: { "application/json": { schema: StockAdjustSchema } } } },
  responses: {
    200: { description: "Bestand aktualisiert" },
    422: { description: "Unterdeckung verhindert" },
    404: { description: "Artikel/Lagerplatz nicht gefunden" },
  },
});
registry.registerPath({
  method: "post", path: "/stock/move", summary: "Umbuchung zwischen Lagerplätzen", tags: ["Stock"],
  request: { body: { content: { "application/json": { schema: StockMoveSchema } } } },
  responses: {
    200: { description: "Umgebucht" },
    422: { description: "Quelle hat zu wenig Bestand" },
    404: { description: "Artikel/Lagerplätze nicht gefunden" },
  },
});
registry.registerPath({
  method: "get", path: "/stock/{articleId}/history", summary: "Bewegungs-Historie für einen Artikel", tags: ["Stock"],
  request: { params: z.object({ articleId: z.string().cuid() }), query: StockHistoryQuerySchema },
  responses: { 200: { description: "Liste von StockMovement-Einträgen" } },
});
