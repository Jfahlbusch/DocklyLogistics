import { z } from "zod";
import { registry } from "@/lib/api/openapi";

export const SuggestionReasonSchema = z.enum(["AUTO_MIN_STOCK", "MANUAL_SCAN"]);
export const SuggestionStatusSchema = z.enum(["PENDING", "CONFIRMED", "DISMISSED"]);

export const OrderSuggestionCreateSchema = z.object({
  articleId: z.string().cuid(),
  supplierId: z.string().cuid().optional(),
  qtyOrderUnit: z.number().int().min(1),
  reason: SuggestionReasonSchema.default("MANUAL_SCAN"),
  note: z.string().max(500).optional(),
}).openapi("OrderSuggestionCreate");

export const OrderSuggestionUpdateSchema = z.object({
  supplierId: z.string().cuid().optional(),
  qtyOrderUnit: z.number().int().min(1).optional(),
  note: z.string().max(500).optional(),
}).openapi("OrderSuggestionUpdate");

export const OrderSuggestionListQuerySchema = z.object({
  status: SuggestionStatusSchema.optional(),
  articleId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(100),
});

export const BulkConfirmSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(200),
}).openapi("BulkConfirm");

export type OrderSuggestionCreate = z.infer<typeof OrderSuggestionCreateSchema>;
export type OrderSuggestionUpdate = z.infer<typeof OrderSuggestionUpdateSchema>;

registry.registerPath({
  method: "get",
  path: "/order-suggestions",
  summary: "Bestellvorschläge auflisten",
  tags: ["Suggestions"],
  request: { query: OrderSuggestionListQuerySchema },
  responses: { 200: { description: "Liste" } },
});
registry.registerPath({
  method: "post",
  path: "/order-suggestions",
  summary: "Manuellen Vorschlag anlegen",
  tags: ["Suggestions"],
  request: { body: { content: { "application/json": { schema: OrderSuggestionCreateSchema } } } },
  responses: { 201: { description: "Angelegt" }, 422: { description: "Validierungsfehler" } },
});
registry.registerPath({
  method: "patch",
  path: "/order-suggestions/{id}",
  summary: "Vorschlag bearbeiten (Menge/Lieferant)",
  tags: ["Suggestions"],
  request: {
    params: z.object({ id: z.string().cuid() }),
    body: { content: { "application/json": { schema: OrderSuggestionUpdateSchema } } },
  },
  responses: {
    200: { description: "Aktualisiert" },
    404: { description: "Nicht gefunden" },
    409: { description: "Nicht mehr PENDING" },
  },
});
registry.registerPath({
  method: "post",
  path: "/order-suggestions/{id}/confirm",
  summary: "Vorschlag bestätigen (CONFIRMED)",
  tags: ["Suggestions"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: {
    200: { description: "Bestätigt" },
    404: { description: "Nicht gefunden" },
    409: { description: "Nicht mehr PENDING" },
  },
});
registry.registerPath({
  method: "post",
  path: "/order-suggestions/{id}/dismiss",
  summary: "Vorschlag verwerfen",
  tags: ["Suggestions"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 200: { description: "Verworfen" }, 404: { description: "Nicht gefunden" } },
});
registry.registerPath({
  method: "post",
  path: "/order-suggestions/bulk-confirm",
  summary: "Mehrere Vorschläge bestätigen",
  tags: ["Suggestions"],
  request: { body: { content: { "application/json": { schema: BulkConfirmSchema } } } },
  responses: { 200: { description: "Anzahl bestätigt" } },
});
registry.registerPath({
  method: "post",
  path: "/order-suggestions/regenerate",
  summary: "Auto-Vorschläge neu berechnen",
  tags: ["Suggestions"],
  responses: { 200: { description: "Vorgangs-Statistik" } },
});
