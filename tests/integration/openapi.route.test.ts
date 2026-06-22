import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/v1/openapi.json/route";

describe("GET /api/v1/openapi.json", () => {
  it("builds the spec and includes the newly-registered routes", async () => {
    const res = GET();
    const doc = (await res.json()) as { paths: Record<string, unknown> };
    for (const p of ["/search", "/dashboard", "/me/api-keys", "/me/notifications", "/stock/inventory"]) {
      expect(doc.paths[p], `path ${p} missing`).toBeTruthy();
    }
  });
});
