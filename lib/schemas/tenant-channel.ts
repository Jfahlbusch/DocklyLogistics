import { z } from "zod";
import { registry } from "@/lib/api/openapi";
import { SupplierChannelSchema } from "./supplier";

/* Channel-specific config payloads (Zod-validated in the API layer) */

export const EmailChannelConfigSchema = z.object({
  fromEmail: z.string().email(),
  fromName: z.string().min(1).max(200),
  replyTo: z.string().email().optional(),
  smtp: z.object({
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    user: z.string().min(1),
    pass: z.string().min(1),
    secure: z.boolean().default(true),
  }).optional(),
  signature: z.string().max(2000).optional(),
  pdfLogo: z.string().url().optional(),
}).openapi("EmailChannelConfig");

export const ApiChannelConfigSchema = z.object({
  defaultClientId: z.string().optional(),
  defaultHeaders: z.record(z.string(), z.string()).optional(),
  callbackUrl: z.string().url().optional(),
}).openapi("ApiChannelConfig");

export const EdiChannelConfigSchema = z.object({
  senderId: z.string().min(1),
  senderQualifier: z.string().min(1).max(10),
  edifactVersion: z.literal("D.96A"),
  sftp: z.object({
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535).default(22),
    user: z.string().min(1),
    keyOrPassword: z.string().min(1),
    remotePath: z.string().min(1),
  }),
  encoding: z.enum(["UTF-8", "ISO-8859-1"]).optional(),
}).openapi("EdiChannelConfig");

/* Discriminated by `channel` — pick the right shape at validation time */
function parseChannelConfig(channel: "EMAIL" | "API" | "EDI", raw: unknown) {
  switch (channel) {
    case "EMAIL": return EmailChannelConfigSchema.parse(raw);
    case "API": return ApiChannelConfigSchema.parse(raw);
    case "EDI": return EdiChannelConfigSchema.parse(raw);
  }
}

export const TenantChannelConfigCreateSchema = z.object({
  channel: SupplierChannelSchema,
  active: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  label: z.string().max(120).optional(),
  config: z.unknown(),
}).superRefine((val, ctx) => {
  try {
    parseChannelConfig(val.channel, val.config);
  } catch (err) {
    if (err instanceof z.ZodError) {
      for (const issue of err.issues) {
        ctx.addIssue({ ...issue, path: ["config", ...issue.path] });
      }
    } else {
      ctx.addIssue({ code: "custom", message: "Invalid config", path: ["config"] });
    }
  }
}).openapi("TenantChannelConfigCreate");

export const TenantChannelConfigUpdateSchema = z.object({
  active: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  label: z.string().max(120).optional(),
  config: z.unknown().optional(),
}).openapi("TenantChannelConfigUpdate");

export const TenantChannelConfigListQuerySchema = z.object({
  channel: SupplierChannelSchema.optional(),
  active: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});

export type TenantChannelConfigCreate = z.infer<typeof TenantChannelConfigCreateSchema>;
export type TenantChannelConfigUpdate = z.infer<typeof TenantChannelConfigUpdateSchema>;

export { parseChannelConfig };

registry.registerPath({
  method: "get", path: "/settings/channels", summary: "Versand-Profile (Tenant)", tags: ["Settings"],
  request: { query: TenantChannelConfigListQuerySchema },
  responses: { 200: { description: "Liste" } },
});
registry.registerPath({
  method: "post", path: "/settings/channels", summary: "Versand-Profil anlegen", tags: ["Settings"],
  request: { body: { content: { "application/json": { schema: TenantChannelConfigCreateSchema } } } },
  responses: { 201: { description: "Angelegt" }, 422: { description: "Validierungsfehler" }, 409: { description: "Label existiert bereits" } },
});
registry.registerPath({
  method: "get", path: "/settings/channels/{id}", summary: "Versand-Profil Detail", tags: ["Settings"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 200: { description: "OK" }, 404: { description: "Nicht gefunden" } },
});
registry.registerPath({
  method: "patch", path: "/settings/channels/{id}", summary: "Versand-Profil aktualisieren", tags: ["Settings"],
  request: { params: z.object({ id: z.string().cuid() }), body: { content: { "application/json": { schema: TenantChannelConfigUpdateSchema } } } },
  responses: { 200: { description: "Aktualisiert" }, 404: { description: "Nicht gefunden" } },
});
registry.registerPath({
  method: "delete", path: "/settings/channels/{id}", summary: "Versand-Profil löschen", tags: ["Settings"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 204: { description: "Gelöscht" }, 404: { description: "Nicht gefunden" } },
});
registry.registerPath({
  method: "post", path: "/settings/channels/{id}/test", summary: "Test-Versand", tags: ["Settings"],
  request: { params: z.object({ id: z.string().cuid() }) },
  responses: { 200: { description: "Test erfolgreich (Mock in M2)" }, 404: { description: "Nicht gefunden" } },
});
