import { z } from "zod";
import { registry } from "@/lib/api/openapi";

export const OrderStatusSchema = z.enum([
  "DRAFT","REVIEW","APPROVED","SENT","CONFIRMED",
  "PARTIALLY_RECEIVED","RECEIVED","CLOSED","CANCELLED",
]);

export const OrderItemInputSchema = z.object({
  articleId: z.string().cuid(),
  qtyOrderUnit: z.number().int().min(1),
  unitPrice: z.number().min(0),
}).openapi("OrderItemInput");

export const OrderCreateSchema = z.object({
  supplierId: z.string().cuid(),
  currency: z.string().length(3).default("EUR"),
  notes: z.string().max(2000).optional(),
  items: z.array(OrderItemInputSchema).min(1),
}).openapi("OrderCreate");

export const OrderUpdateSchema = z.object({
  currency: z.string().length(3).optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(OrderItemInputSchema).min(1).optional(),
}).openapi("OrderUpdate");

export const OrderListQuerySchema = z.object({
  status: OrderStatusSchema.optional(),
  supplierId: z.string().cuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});

export const OrderCancelSchema = z.object({
  reason: z.string().max(500).optional(),
}).openapi("OrderCancel");

export const OrderReceiveSchema = z.object({
  items: z.array(z.object({
    itemId: z.string().cuid(),
    qtyBase: z.number().int().min(0),    // base units received (cumulative this call)
    locationId: z.string().cuid().optional(),  // defaults to article.defaultLocationId
  })).min(1),
  note: z.string().max(500).optional(),
}).openapi("OrderReceive");

export type OrderCreate = z.infer<typeof OrderCreateSchema>;
export type OrderUpdate = z.infer<typeof OrderUpdateSchema>;
export type OrderReceive = z.infer<typeof OrderReceiveSchema>;

registry.registerPath({ method: "get", path: "/orders", summary: "Bestellungen auflisten", tags: ["Orders"],
  request: { query: OrderListQuerySchema },
  responses: { 200: { description: "Liste (paginiert)" } } });
registry.registerPath({ method: "post", path: "/orders", summary: "Bestellung anlegen", tags: ["Orders"],
  request: { body: { content: { "application/json": { schema: OrderCreateSchema } } } },
  responses: { 201: { description: "Angelegt (REVIEW)" }, 422: { description: "Validierungsfehler" } } });
registry.registerPath({ method: "get", path: "/orders/{id}", summary: "Bestellung Detail", tags: ["Orders"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 200: { description: "OK" }, 404: { description: "Nicht gefunden" } } });
registry.registerPath({ method: "patch", path: "/orders/{id}", summary: "Bestellung bearbeiten (DRAFT/REVIEW)", tags: ["Orders"],
  request: { params: z.object({ id: z.string().cuid() }), body: { content: { "application/json": { schema: OrderUpdateSchema } } } },
  responses: { 200: { description: "Aktualisiert" }, 409: { description: "Status verbietet Bearbeitung" } } });
registry.registerPath({ method: "post", path: "/orders/{id}/approve", summary: "Bestellung freigeben (REVIEW→APPROVED)", tags: ["Orders"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 200: { description: "Freigegeben" }, 409: { description: "Falscher Status" } } });
registry.registerPath({ method: "post", path: "/orders/{id}/send", summary: "Bestellung versenden (APPROVED→SENT)", tags: ["Orders"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 200: { description: "Versendet" }, 409: { description: "Falscher Status" }, 422: { description: "Kanal-Versand fehlgeschlagen" } } });
registry.registerPath({ method: "post", path: "/orders/{id}/cancel", summary: "Bestellung stornieren (bis CONFIRMED)", tags: ["Orders"],
  request: { params: z.object({ id: z.string().cuid() }), body: { content: { "application/json": { schema: OrderCancelSchema } } } },
  responses: { 200: { description: "Storniert" }, 409: { description: "Status verbietet Storno" } } });
registry.registerPath({ method: "post", path: "/orders/{id}/receive", summary: "Wareneingang buchen", tags: ["Orders"],
  request: { params: z.object({ id: z.string().cuid() }), body: { content: { "application/json": { schema: OrderReceiveSchema } } } },
  responses: { 200: { description: "Wareneingang gebucht" }, 409: { description: "Falscher Status" } } });
registry.registerPath({ method: "get", path: "/orders/{id}/events", summary: "Event-Timeline", tags: ["Orders"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 200: { description: "OK" } } });
registry.registerPath({ method: "get", path: "/orders/{id}/pdf", summary: "PDF-Bestellschein (gerendert via @react-pdf)", tags: ["Orders"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 200: { description: "PDF Bytes" } } });
