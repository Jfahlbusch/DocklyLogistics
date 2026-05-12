import { z } from "zod";
import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";

/**
 * Separate registry for the public API — keeps the internal /api-docs spec
 * and the public /api-docs/public spec independent.
 */
export const publicRegistry = new OpenAPIRegistry();

publicRegistry.registerComponent("securitySchemes", "ApiKeyAuth", {
  type: "apiKey",
  in: "header",
  name: "X-API-Key",
});

export const PublicOrderListQuerySchema = z.object({
  status: z.enum(["SENT", "CONFIRMED", "PARTIALLY_RECEIVED", "RECEIVED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const PublicOrderConfirmSchema = z.object({
  acknowledgement: z.string().max(500).optional(),
  expectedDeliveryAt: z.string().datetime().optional(),
});

export const PublicWebhookInboundSchema = z.object({
  event: z.string().min(1).max(100),
  data: z.record(z.string(), z.unknown()),
});

publicRegistry.registerPath({
  method: "get",
  path: "/orders",
  summary: "Eigene Bestellungen abrufen",
  tags: ["Orders"],
  security: [{ ApiKeyAuth: [] }],
  request: { query: PublicOrderListQuerySchema },
  responses: {
    200: { description: "Paginierte Liste" },
    401: { description: "Auth fehlt" },
    403: { description: "Scope fehlt" },
  },
});

publicRegistry.registerPath({
  method: "post",
  path: "/orders/{id}/confirm",
  summary: "Bestellung bestätigen",
  tags: ["Orders"],
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({ id: z.string().cuid() }),
    body: { content: { "application/json": { schema: PublicOrderConfirmSchema } } },
  },
  responses: {
    200: { description: "Bestätigt (CONFIRMED)" },
    404: { description: "Bestellung nicht gefunden / gehört nicht zum Caller" },
    409: { description: "Status erlaubt keine Bestätigung" },
  },
});

publicRegistry.registerPath({
  method: "post",
  path: "/webhooks/inbound/{supplierId}",
  summary: "Inbound-Webhook vom Lieferanten",
  tags: ["Webhooks"],
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({ supplierId: z.string().cuid() }),
    body: { content: { "application/json": { schema: PublicWebhookInboundSchema } } },
  },
  responses: { 202: { description: "Akzeptiert (gespeichert für Verarbeitung)" } },
});

export function buildPublicOpenApi() {
  const generator = new OpenApiGeneratorV31(publicRegistry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "DocklyLogistics Public API (Lieferanten)",
      version: "1.0.0",
      description: "Lieferanten-API für Bestellabruf, Bestätigung und Webhook-Empfang.",
    },
    servers: [{ url: "/api/public/v1", description: "Public API" }],
    security: [{ ApiKeyAuth: [] }],
  });
}
