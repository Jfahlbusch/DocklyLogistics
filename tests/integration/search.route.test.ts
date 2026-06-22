import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import { GET } from "@/app/api/v1/search/route";
import { makeRequest, sessionHeaders, readJson } from "./helpers";

const T = "test-int-search";

type SearchBody = { data: { groups: Array<{ key: string; items: Array<{ id: string; title: string; href: string }> }> } };
const url = (q: string) => `http://localhost/api/v1/search?q=${encodeURIComponent(q)}`;

describe("GET /api/v1/search", () => {
  beforeAll(async () => {
    await prisma.tenant.upsert({ where: { id: T }, update: {}, create: { id: T, name: T } });
    await prisma.article.create({
      data: {
        tenantId: T,
        sku: "MEHL-1",
        name: "Weizenmehl Type 405",
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
    const res = await GET(makeRequest(url("mehl")));
    expect(res.status).toBe(401);
  });

  it("returns empty groups below the 2-char minimum", async () => {
    const res = await GET(makeRequest(url("m"), { headers: sessionHeaders("VIEWER", T) }));
    expect(res.status).toBe(200);
    const b = await readJson<SearchBody>(res);
    expect(b.data.groups).toEqual([]);
  });

  it("finds the tenant's articles and deep-links them", async () => {
    const res = await GET(makeRequest(url("Weizen"), { headers: sessionHeaders("VIEWER", T) }));
    expect(res.status).toBe(200);
    const b = await readJson<SearchBody>(res);
    const articles = b.data.groups.find((g) => g.key === "articles");
    expect(articles).toBeTruthy();
    expect(articles!.items[0].title).toContain("Weizenmehl");
    expect(articles!.items[0].href).toBe(`/articles?open=${articles!.items[0].id}`);
  });

  it("does not leak other tenants' data", async () => {
    const res = await GET(makeRequest(url("Weizen"), { headers: sessionHeaders("VIEWER", "other-tenant") }));
    const b = await readJson<SearchBody>(res);
    expect(b.data.groups).toEqual([]);
  });
});
