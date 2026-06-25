import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Adds .openapi() method to Zod schemas
extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

export function buildOpenApi() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "DocklyLogistics API",
      version: "1.0.0",
      description:
        "Interne API der DocklyLogistics WebApp.\n\n" +
        "**Externe Zugriffe** authentifizieren sich mit einem persönlichen API-Key " +
        "(in der App unter Einstellungen → API-Keys erzeugen). Den Key als " +
        "`X-API-Key: dlg_live_….<secret>` senden — alternativ " +
        "`Authorization: Bearer dlg_live_….<secret>`. Der Key erbt Rolle und Tenant " +
        "seines Erstellers. Die WebApp selbst nutzt stattdessen die Login-Session.",
    },
    servers: [{ url: "/api/v1", description: "Internal API" }],
    security: [{ ApiKeyAuth: [] }, { bearerAuth: [] }],
  });
}

// External clients authenticate with a personal API key (Settings → API-Keys), sent
// either as `X-API-Key` or `Authorization: Bearer …` (the key is NOT a JWT). The UI
// itself uses the NextAuth session, so these schemes document the programmatic path.
registry.registerComponent("securitySchemes", "ApiKeyAuth", {
  type: "apiKey",
  in: "header",
  name: "X-API-Key",
});
registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "API key (dlg_live_….<secret>)",
});
