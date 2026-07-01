import { z } from "zod";
import { registry } from "@/lib/api/openapi";

/* EDI monitor + settings — Zod schemas and OpenAPI registration. */

export const EdiMessageListQuerySchema = z.object({
  direction: z.enum(["IN", "OUT"]).optional(),
  status: z.enum(["RECEIVED", "PROCESSED", "FAILED", "PENDING", "SENT", "SEND_FAILED"]).optional(),
  type: z.string().max(20).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});

export const EdiSettingsUpdateSchema = z.object({
  inboundActive: z.boolean().optional(),
  autoConfirm: z.boolean().optional(),
}).openapi("EdiSettingsUpdate");

export const EdiSettingsSchema = z.object({
  inboundToken: z.string(),
  inboundActive: z.boolean(),
  autoConfirm: z.boolean(),
  inboundPath: z.string(),
}).openapi("EdiSettings");

export const EdiMessageSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  direction: z.enum(["IN", "OUT"]),
  type: z.string(),
  status: z.string(),
  transport: z.string().nullable(),
  supplierId: z.string().nullable(),
  supplierName: z.string().nullable().optional(),
  orderId: z.string().nullable(),
  interchangeRef: z.string().nullable(),
  documentNo: z.string().nullable(),
  payload: z.string().optional(),
  parsed: z.unknown().nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
}).openapi("EdiMessage");

export type EdiSettingsUpdate = z.infer<typeof EdiSettingsUpdateSchema>;

// OpenAPI registration
registry.registerPath({
  method: "get", path: "/edi/messages", summary: "EDI-Nachrichten auflisten (Monitor)", tags: ["EDI"],
  description:
    "Archiv aller ein- und ausgehenden EDIFACT-Nachrichten (ohne Roh-Payload — siehe Detail-Endpunkt). " +
    "Partner senden eingehende Nachrichten per POST an das Tenant-Postfach `/api/edi/inbound/{token}` " +
    "(Roh-EDIFACT als text/plain; Token unter Einstellungen → EDI).",
  request: { query: EdiMessageListQuerySchema },
  responses: { 200: { description: "Paginierte Liste" } },
});
registry.registerPath({
  method: "get", path: "/edi/messages/{id}", summary: "EDI-Nachricht mit Roh-Payload", tags: ["EDI"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 200: { description: "OK" }, 404: { description: "Nicht gefunden" } },
});
registry.registerPath({
  method: "post", path: "/edi/messages/{id}/reprocess", summary: "Eingehende Nachricht erneut verarbeiten", tags: ["EDI"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: {
    200: { description: "Verarbeitungsergebnis" },
    404: { description: "Nicht gefunden" },
    409: { description: "Nur für eingehende Nachrichten möglich" },
  },
});
registry.registerPath({
  method: "get", path: "/settings/edi", summary: "EDI-Einstellungen (Postfach-Token, Flags)", tags: ["EDI"],
  description:
    "Liefert das Inbound-Postfach des Tenants. Die eigene EDI-Identität (GLN/Qualifier) " +
    "wird im EDI-Versandprofil gepflegt (Einstellungen → Versand).",
  responses: { 200: { description: "OK" } },
});
registry.registerPath({
  method: "put", path: "/settings/edi", summary: "EDI-Einstellungen ändern", tags: ["EDI"],
  request: { body: { content: { "application/json": { schema: EdiSettingsUpdateSchema } } } },
  responses: { 200: { description: "Aktualisiert" }, 422: { description: "Validierungsfehler" } },
});
registry.registerPath({
  method: "post", path: "/settings/edi/rotate-token", summary: "EDI-Postfach-Token rotieren", tags: ["EDI"],
  description: "Erzeugt eine neue Postfach-Adresse; der alte Token ist sofort ungültig.",
  responses: { 200: { description: "Neuer Token" } },
});
