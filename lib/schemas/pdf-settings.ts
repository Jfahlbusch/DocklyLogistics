import { z } from "zod";
import { registry } from "@/lib/api/openapi";

// Logo is stored inline as a data: URI (uploaded in the UI). Cap the size so the
// DB row and the rendered PDF stay reasonable (~300 KB image → ~400 KB base64).
const MAX_LOGO_CHARS = 400_000;

export const PdfSettingsSchema = z
  .object({
    logoDataUri: z
      .union([
        z.literal(""),
        z
          .string()
          .regex(/^data:image\/[a-z.+-]+;base64,/, "Es wird ein Bild als Daten-URI erwartet.")
          .max(MAX_LOGO_CHARS, "Logo ist zu groß (max. ~300 KB)."),
      ])
      .nullable()
      .optional(),
    headerText: z.string().max(500).nullable().optional(),
    footerText: z.string().max(500).nullable().optional(),
  })
  .openapi("PdfSettings");

export type PdfSettingsInput = z.infer<typeof PdfSettingsSchema>;

registry.registerPath({
  method: "get",
  path: "/settings/pdf",
  summary: "Bestellschein-Branding (Logo, Briefkopf, Brieffuß) lesen",
  tags: ["Settings"],
  responses: { 200: { description: "{ logoDataUri, headerText, footerText }" } },
});
registry.registerPath({
  method: "put",
  path: "/settings/pdf",
  summary: "Bestellschein-Branding speichern (grafisch, pro Mandant)",
  tags: ["Settings"],
  request: { body: { content: { "application/json": { schema: PdfSettingsSchema } } } },
  responses: { 200: { description: "Gespeichert" }, 422: { description: "Validierungsfehler" } },
});
