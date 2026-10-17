import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { makeRequest, sessionHeaders, readJson } from "./helpers";
import { purgeAppendOnly } from "../helpers/purge-append-only";

// The route imports `auth` (NextAuth) for the create actor; mock it so loading the
// route doesn't pull in the full NextAuth runtime (and its next/server resolution).
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { email: "tester@dockly.de", id: "tester" } })),
}));

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
    await purgeAppendOnly(prisma, { tenantIds: [T] });
    await prisma.article.deleteMany({ where: { tenantId: T } });
    await prisma.tenant.deleteMany({ where: { id: T } });
  });

  it("401 without auth headers", async () => {
    expect((await GET(makeRequest(ART_URL))).status).toBe(401);
  });

  it("lists only the tenant's articles (VIEWER)", async () => {
    const res = await GET(makeRequest(ART_URL, { headers: await sessionHeaders("VIEWER", T) }));
    expect(res.status).toBe(200);
    const b = await readJson<{ data: Array<{ sku: string }>; meta: { total: number } }>(res);
    expect(b.meta.total).toBe(1);
    expect(b.data.every((a) => a.sku === "A-1")).toBe(true);
    expect(b.data[0]).toHaveProperty("maxStock", null);
    expect(b.data[0]).toHaveProperty("targetStock", null);
  });

  const newArticle = (over: Record<string, unknown>) => ({
    sku: "NEW-1",
    name: "Neu",
    baseUnit: "KG",
    orderUnit: "SACK",
    packFactor: 25,
    ...over,
  });

  it("201: legt einen Artikel mit maxStock/targetStock an", async () => {
    const res = await POST(
      makeRequest(ART_URL, {
        method: "POST",
        headers: await sessionHeaders("USER", T),
        body: newArticle({ minStock: 100, targetStock: 300, maxStock: 500 }),
      }),
    );
    expect(res.status).toBe(201);
    const b = await readJson<{ data: { maxStock: number; targetStock: number } }>(res);
    expect(b.data.maxStock).toBe(500);
    expect(b.data.targetStock).toBe(300);
  });

  it("422 mit Feldname bei unplausibler Kombination (POST)", async () => {
    const res = await POST(
      makeRequest(ART_URL, {
        method: "POST",
        headers: await sessionHeaders("USER", T),
        body: newArticle({ sku: "NEW-2", minStock: 100, targetStock: 50 }),
      }),
    );
    expect(res.status).toBe(422);
    const b = await readJson<{ errors: Record<string, string[]> }>(res);
    expect(Object.keys(b.errors)).toContain("targetStock");
  });

  it("403 when creating below the required role (VIEWER < USER)", async () => {
    const res = await POST(
      makeRequest(ART_URL, { method: "POST", headers: await sessionHeaders("VIEWER", T), body: { sku: "X", name: "X" } }),
    );
    expect(res.status).toBe(403);
  });
});
