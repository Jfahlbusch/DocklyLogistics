import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { makeRequest, sessionHeaders, readJson } from "./helpers";

// The route imports `auth` (NextAuth) for the create actor; mock it so loading the
// route doesn't pull in the full NextAuth runtime (and its next/server resolution).
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => null) }));

import { GET, POST } from "@/app/api/v1/articles/route";

const T = "test-int-articles";
const ART_URL = "http://localhost/api/v1/articles";

describe("/api/v1/articles", () => {
  beforeAll(async () => {
    await prisma.tenant.upsert({ where: { id: T }, update: {}, create: { id: T, name: T } });
    await prisma.article.create({
      data: {
        tenantId: T,
        sku: "A-1",
        name: "Test Artikel",
        baseUnit: "KG",
        orderUnit: "SACK",
        packFactor: 25,
        barcodeSource: "SKU",
        minStock: 0,
      },
    });
  });
  afterAll(async () => {
    await prisma.article.deleteMany({ where: { tenantId: T } });
    await prisma.tenant.deleteMany({ where: { id: T } });
  });

  it("401 without auth headers", async () => {
    expect((await GET(makeRequest(ART_URL))).status).toBe(401);
  });

  it("lists only the tenant's articles (VIEWER)", async () => {
    const res = await GET(makeRequest(ART_URL, { headers: sessionHeaders("VIEWER", T) }));
    expect(res.status).toBe(200);
    const b = await readJson<{ data: Array<{ sku: string }>; meta: { total: number } }>(res);
    expect(b.meta.total).toBe(1);
    expect(b.data.every((a) => a.sku === "A-1")).toBe(true);
  });

  it("403 when creating below the required role (VIEWER < USER)", async () => {
    const res = await POST(
      makeRequest(ART_URL, { method: "POST", headers: sessionHeaders("VIEWER", T), body: { sku: "X", name: "X" } }),
    );
    expect(res.status).toBe(403);
  });
});
