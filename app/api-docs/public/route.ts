import { ApiReference } from "@scalar/nextjs-api-reference";

// Scalar UI for the public (supplier-facing) OpenAPI spec.
// Internal page — secured by NextAuth via middleware. Supplier auth on the
// actual /api/public/v1/* endpoints goes through X-API-Key.
export const GET = ApiReference({
  url: "/api/public/v1/openapi.json",
  theme: "default",
  layout: "modern",
  hideClientButton: false,
  metaData: {
    title: "DocklyLogistics Public API Reference",
  },
});
