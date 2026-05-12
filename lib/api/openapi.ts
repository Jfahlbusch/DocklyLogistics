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
      description: "Interne API für die DocklyLogistics WebApp.",
    },
    servers: [{ url: "/api/v1", description: "Internal API" }],
    security: [{ bearer: [] }],
  });
}

// Register a common Bearer security scheme — used by all internal endpoints.
registry.registerComponent("securitySchemes", "bearer", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});
