import { ApiReference } from "@scalar/nextjs-api-reference";

// `@scalar/nextjs-api-reference` is a route-handler integration: it returns
// a GET handler that serves the Scalar HTML shell, which then fetches the
// spec from the configured URL on the client.
export const GET = ApiReference({
  url: "/api/v1/openapi.json",
  theme: "default",
  layout: "modern",
  hideClientButton: false,
  metaData: {
    title: "DocklyLogistics API Reference",
  },
});
