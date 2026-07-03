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

const CertPem = z.string().max(20000).refine(
  (v) => v.includes("BEGIN CERTIFICATE"),
  "PEM-Zertifikat erwartet (-----BEGIN CERTIFICATE-----)",
);

export const EdiPartnerCreateSchema = z.object({
  name: z.string().min(1).max(120),
  partnerGln: z.string().min(4).max(20).nullish(),
  supplierId: z.string().cuid().nullish(),
  as2Id: z.string().min(1).max(128).nullish(),
  as2CertificatePem: CertPem.nullish(),
  as2Url: z.string().url().nullish(),
}).openapi("EdiPartnerCreate");

export const EdiPartnerUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  partnerGln: z.string().min(4).max(20).nullable().optional(),
  supplierId: z.string().cuid().nullable().optional(),
  active: z.boolean().optional(),
  as2Id: z.string().min(1).max(128).nullable().optional(),
  as2CertificatePem: CertPem.nullable().optional(),
  as2Url: z.string().url().nullable().optional(),
}).openapi("EdiPartnerUpdate");

export const As2IdentityGenerateSchema = z.object({
  as2Id: z.string().min(1).max(128).optional(),
}).openapi("As2IdentityGenerate");

export const SftpSettingsUpdateSchema = z.object({
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535).default(22),
  username: z.string().min(1).max(128),
  authType: z.enum(["KEY", "PASSWORD"]),
  privateKey: z.string().max(20000).optional(), // empty = keep stored
  password: z.string().max(1000).optional(),
  hostKeyFingerprint: z.string().max(200).nullish(),
  outboxDir: z.string().min(1).max(255).default("/outbox"),
  inboxDir: z.string().min(1).max(255).default("/inbox"),
  inboxFormat: z.enum(["XML", "EDIFACT"]).default("XML"),
  routing: z.enum(["FILE", "SUBFOLDER"]).default("FILE"),
  active: z.boolean().default(true),
  autoSend: z.boolean().default(true),
}).openapi("SftpSettingsUpdate");

export type EdiSettingsUpdate = z.infer<typeof EdiSettingsUpdateSchema>;
export type EdiPartnerCreate = z.infer<typeof EdiPartnerCreateSchema>;
export type EdiPartnerUpdate = z.infer<typeof EdiPartnerUpdateSchema>;

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
registry.registerPath({
  method: "get", path: "/settings/edi/partners", summary: "Partner-Postfächer auflisten", tags: ["EDI"],
  description:
    "Jeder Partner bekommt eine eigene Postfach-Adresse (einzeln sperr- und rotierbar). " +
    "Optional gebunden: `partnerGln` pinnt den UNB-Absender, `supplierId` beschränkt " +
    "ORDRSP auf Bestellungen dieses Lieferanten.",
  responses: { 200: { description: "Liste" } },
});
registry.registerPath({
  method: "post", path: "/settings/edi/partners", summary: "Partner-Postfach anlegen", tags: ["EDI"],
  request: { body: { content: { "application/json": { schema: EdiPartnerCreateSchema } } } },
  responses: { 201: { description: "Angelegt (inkl. Token)" }, 409: { description: "Name existiert" } },
});
registry.registerPath({
  method: "patch", path: "/settings/edi/partners/{id}", summary: "Partner-Postfach ändern", tags: ["EDI"],
  request: {
    params: z.object({ id: z.string().cuid() }),
    body: { content: { "application/json": { schema: EdiPartnerUpdateSchema } } },
  },
  responses: { 200: { description: "Aktualisiert" }, 404: { description: "Nicht gefunden" } },
});
registry.registerPath({
  method: "delete", path: "/settings/edi/partners/{id}", summary: "Partner-Postfach löschen", tags: ["EDI"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 204: { description: "Gelöscht (Token sofort ungültig)" }, 404: { description: "Nicht gefunden" } },
});
registry.registerPath({
  method: "post", path: "/settings/edi/partners/{id}/rotate-token", summary: "Partner-Token rotieren", tags: ["EDI"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 200: { description: "Neuer Token" }, 404: { description: "Nicht gefunden" } },
});
registry.registerPath({
  method: "get", path: "/settings/edi/as2-identity", summary: "AS2-Identität des Tenants", tags: ["EDI"],
  description: "AS2-ID, Zertifikat (PEM) und SHA-256-Fingerprint. Der private Schlüssel verlässt den Server nie.",
  responses: { 200: { description: "Identität oder null" } },
});
registry.registerPath({
  method: "post", path: "/settings/edi/as2-identity", summary: "AS2-Identität erzeugen/erneuern", tags: ["EDI"],
  description: "Erzeugt ein neues RSA-2048-Schlüsselpaar + self-signed Zertifikat (5 Jahre). Partner brauchen danach das neue Zertifikat.",
  request: { body: { content: { "application/json": { schema: As2IdentityGenerateSchema } } } },
  responses: { 200: { description: "Neue Identität" } },
});
registry.registerPath({
  method: "get", path: "/settings/edi/sftp", summary: "SFTP-Anbindung (Warenwirtschaft)", tags: ["EDI"],
  description:
    "SFTP-Brücke zur WaWi: DocklyLogistics pollt den Ausgangsordner (WaWi legt fertiges " +
    "EDIFACT ab → wir übertragen an den Partner) und schreibt empfangene Dokumente in den " +
    "Eingangsordner. Zugangsdaten sind AES-verschlüsselt; der Response enthält nie Key/Passwort.",
  responses: { 200: { description: "Konfiguration oder null" } },
});
registry.registerPath({
  method: "put", path: "/settings/edi/sftp", summary: "SFTP-Anbindung speichern", tags: ["EDI"],
  description: "Leeres Key-/Passwort-Feld behält das gespeicherte Geheimnis.",
  request: { body: { content: { "application/json": { schema: SftpSettingsUpdateSchema } } } },
  responses: { 200: { description: "Gespeichert" }, 422: { description: "Validierungsfehler" } },
});
registry.registerPath({
  method: "post", path: "/settings/edi/sftp/test", summary: "SFTP-Verbindung testen", tags: ["EDI"],
  responses: { 200: { description: "Verbunden" }, 422: { description: "Verbindung fehlgeschlagen" } },
});
registry.registerPath({
  method: "post", path: "/settings/edi/sftp/poll-now", summary: "Ausgangsordner jetzt abrufen/versenden", tags: ["EDI"],
  responses: { 200: { description: "Ergebnis (verarbeitet/gesendet/fehlgeschlagen)" } },
});
