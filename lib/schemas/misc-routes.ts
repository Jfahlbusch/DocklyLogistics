import { z } from "zod";
import { registry } from "@/lib/api/openapi";

// OpenAPI registrations for routes added after the initial domains (search,
// dashboard, personal API keys, notifications, inventory, webhook retry). Keeps
// the Scalar docs in parity with the actual API.

registry.registerPath({
  method: "get",
  path: "/search",
  summary: "Globale Suche (Artikel, Lieferanten, Bestellungen)",
  tags: ["Suche"],
  request: { query: z.object({ q: z.string().min(2) }) },
  responses: { 200: { description: "Gruppierte Treffer {groups:[{key,label,items}]}" } },
});

registry.registerPath({
  method: "get",
  path: "/dashboard",
  summary: "Dashboard-KPIs + Unterdeckungen + letzte Aktivität",
  tags: ["Dashboard"],
  responses: { 200: { description: "KPIs, Unterdeckungs-Items, Aktivität" } },
});

registry.registerPath({
  method: "get",
  path: "/me/api-keys",
  summary: "Eigene API-Keys auflisten (ohne Secret)",
  tags: ["API-Keys"],
  responses: { 200: { description: "Liste" } },
});
registry.registerPath({
  method: "post",
  path: "/me/api-keys",
  summary: "Persönlichen API-Key erzeugen (Rolle = eigene Rolle)",
  tags: ["API-Keys"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({ label: z.string().max(80).optional(), expiresInDays: z.number().int().min(1).max(365).optional() }),
        },
      },
    },
  },
  responses: { 201: { description: "Erzeugt — voller Key einmalig im Feld 'key'" } },
});
registry.registerPath({
  method: "delete",
  path: "/me/api-keys/{id}",
  summary: "Eigenen API-Key widerrufen",
  tags: ["API-Keys"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 204: { description: "Widerrufen" }, 404: { description: "Nicht gefunden" } },
});

registry.registerPath({
  method: "get",
  path: "/me/notifications",
  summary: "Benachrichtigungen + Anzahl ungelesen",
  tags: ["Benachrichtigungen"],
  responses: { 200: { description: "{ items, unread }" } },
});
registry.registerPath({
  method: "post",
  path: "/me/notifications/read",
  summary: "Benachrichtigung(en) als gelesen markieren",
  tags: ["Benachrichtigungen"],
  request: { body: { content: { "application/json": { schema: z.object({ id: z.string().cuid().optional() }) } } } },
  responses: { 200: { description: "OK (id = eine, leer = alle)" } },
});

registry.registerPath({
  method: "post",
  path: "/stock/inventory",
  summary: "Inventur buchen (Bestände auf gezählte Mengen korrigieren)",
  tags: ["Lager"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            locationId: z.string().cuid(),
            counts: z.array(z.object({ articleId: z.string().cuid(), countedQty: z.number().int().min(0) })).min(1),
          }),
        },
      },
    },
  },
  responses: { 200: { description: "Korrekturen gebucht (INVENTORY-Bewegungen)" }, 404: { description: "Lagerplatz nicht gefunden" } },
});

registry.registerPath({
  method: "post",
  path: "/settings/webhooks/{id}/deliveries/{deliveryId}/retry",
  summary: "Fehlgeschlagene/aufgegebene Webhook-Auslieferung erneut einreihen",
  tags: ["Webhooks"],
  request: { params: z.object({ id: z.string().cuid(), deliveryId: z.string().cuid() }) },
  responses: { 200: { description: "Erneut eingereiht" }, 409: { description: "Nicht im Status FAILED/GIVEN_UP" } },
});
