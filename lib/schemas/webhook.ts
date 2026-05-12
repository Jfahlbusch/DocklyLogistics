import { z } from "zod";
import { registry } from "@/lib/api/openapi";

const WEBHOOK_EVENTS = [
  "order.sent",
  "order.confirmed",
  "order.partially_received",
  "order.received",
  "order.cancelled",
] as const;

export const WebhookEventSchema = z.enum(WEBHOOK_EVENTS);

export const WebhookCreateSchema = z
  .object({
    url: z.string().url().max(500),
    events: z.array(WebhookEventSchema).min(1),
    description: z.string().max(500).optional(),
    active: z.boolean().default(true),
  })
  .openapi("WebhookCreate");

export const WebhookUpdateSchema = z
  .object({
    url: z.string().url().max(500).optional(),
    events: z.array(WebhookEventSchema).min(1).optional(),
    description: z.string().max(500).optional(),
    active: z.boolean().optional(),
  })
  .openapi("WebhookUpdate");

export type WebhookCreate = z.infer<typeof WebhookCreateSchema>;
export type WebhookUpdate = z.infer<typeof WebhookUpdateSchema>;

registry.registerPath({
  method: "get",
  path: "/settings/webhooks",
  summary: "Webhooks auflisten",
  tags: ["Webhooks"],
  responses: { 200: { description: "Liste" } },
});

registry.registerPath({
  method: "post",
  path: "/settings/webhooks",
  summary: "Webhook anlegen",
  tags: ["Webhooks"],
  request: {
    body: { content: { "application/json": { schema: WebhookCreateSchema } } },
  },
  responses: { 201: { description: "Angelegt — Secret einmalig in Antwort" } },
});

registry.registerPath({
  method: "patch",
  path: "/settings/webhooks/{id}",
  summary: "Webhook ändern",
  tags: ["Webhooks"],
  request: {
    params: z.object({ id: z.string().cuid() }),
    body: { content: { "application/json": { schema: WebhookUpdateSchema } } },
  },
  responses: {
    200: { description: "OK" },
    404: { description: "Nicht gefunden" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/settings/webhooks/{id}",
  summary: "Webhook löschen",
  tags: ["Webhooks"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 204: { description: "Gelöscht" } },
});

registry.registerPath({
  method: "post",
  path: "/settings/webhooks/{id}/rotate-secret",
  summary: "Secret rotieren",
  tags: ["Webhooks"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 200: { description: "Neues Secret einmalig in Antwort" } },
});

registry.registerPath({
  method: "get",
  path: "/settings/webhooks/{id}/deliveries",
  summary: "Letzte Zustellungen",
  tags: ["Webhooks"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 200: { description: "Liste" } },
});
