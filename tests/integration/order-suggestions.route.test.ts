import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { purgeAppendOnly } from "../helpers/purge-append-only";
import { makeRequest, sessionHeaders, readJson, routeParams } from "./helpers";

// POST/PATCH schreiben einen Audit-Eintrag und brauchen eine Actor-Identität.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { email: "tester@dockly.de", id: "tester" } })),
}));

import { GET, POST } from "@/app/api/v1/order-suggestions/route";
import { PATCH } from "@/app/api/v1/order-suggestions/[id]/route";

const T = "test-int-order-suggestions";
const OTHER = "test-int-order-suggestions-other";
const listUrl = "http://localhost/api/v1/order-suggestions";
const itemUrl = (id: string) => `${listUrl}/${id}`;

let ownArticleId = "";
let foreignArticleId = "";
let ownSuggestionId = "";
let foreignSuggestionId = "";

async function cleanup() {
  await purgeAppendOnly(prisma, { tenantIds: [T, OTHER] });
  await prisma.orderSuggestion.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.article.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [T, OTHER] } } });
}

describe("/api/v1/order-suggestions (Ist-Verhalten)", () => {
  beforeAll(async () => {
    await cleanup();
    for (const t of [T, OTHER]) {
      await prisma.tenant.create({ data: { id: t, name: t } });
    }
    const base = {
      name: "Vorschlag-Artikel",
      baseUnit: "KG" as const,
      orderUnit: "SACK" as const,
      packFactor: 25,
      barcodeSource: "SKU" as const,
      minStock: 0,
    };
    ownArticleId = (await prisma.article.create({ data: { ...base, tenantId: T, sku: "SUG-1" } })).id;
    foreignArticleId = (
      await prisma.article.create({ data: { ...base, tenantId: OTHER, sku: "SUG-2" } })
    ).id;
    ownSuggestionId = (
      await prisma.orderSuggestion.create({
        data: {
          tenantId: T,
          articleId: ownArticleId,
          qtyOrderUnit: 2,
          reason: "MANUAL_SCAN",
          status: "PENDING",
          createdBy: "seed",
        },
      })
    ).id;
    foreignSuggestionId = (
      await prisma.orderSuggestion.create({
        data: {
          tenantId: OTHER,
          articleId: foreignArticleId,
          qtyOrderUnit: 9,
          reason: "MANUAL_SCAN",
          status: "PENDING",
          createdBy: "seed",
        },
      })
    ).id;
  });

  afterAll(cleanup);

  it("GET liefert 401 ohne Auth-Header", async () => {
    const res = await GET(makeRequest(listUrl));
    expect(res.status).toBe(401);
  });

  it("GET liefert nur Vorschläge des eigenen Mandanten (VIEWER)", async () => {
    const res = await GET(
      makeRequest(listUrl, { headers: await sessionHeaders("VIEWER", T) }),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{ data: { id: string; tenantId: string }[] }>(res);
    const ids = body.data.map((s) => s.id);
    expect(ids).toContain(ownSuggestionId);
    expect(ids).not.toContain(foreignSuggestionId);
    expect(body.data.every((s) => s.tenantId === T)).toBe(true);
  });

  it("POST als VIEWER liefert 403", async () => {
    const res = await POST(
      makeRequest(listUrl, {
        method: "POST",
        headers: await sessionHeaders("VIEWER", T),
        body: { articleId: ownArticleId, qtyOrderUnit: 1 },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("POST als USER liefert 201 und legt PENDING/MANUAL_SCAN an", async () => {
    const res = await POST(
      makeRequest(listUrl, {
        method: "POST",
        headers: await sessionHeaders("USER", T),
        body: { articleId: ownArticleId, qtyOrderUnit: 4, note: "n" },
      }),
    );
    expect(res.status).toBe(201);
    const body = await readJson<{
      data: { id: string; status: string; reason: string; qtyOrderUnit: number; tenantId: string };
    }>(res);
    expect(body.data.status).toBe("PENDING");
    expect(body.data.reason).toBe("MANUAL_SCAN");
    expect(body.data.qtyOrderUnit).toBe(4);
    expect(body.data.tenantId).toBe(T);
  });

  it("POST mit Artikel eines fremden Mandanten liefert 404", async () => {
    const res = await POST(
      makeRequest(listUrl, {
        method: "POST",
        headers: await sessionHeaders("USER", T),
        body: { articleId: foreignArticleId, qtyOrderUnit: 1 },
      }),
    );
    expect(res.status).toBe(404);
  });

  it("PATCH als VIEWER liefert 403", async () => {
    const res = await PATCH(
      makeRequest(itemUrl(ownSuggestionId), {
        method: "PATCH",
        headers: await sessionHeaders("VIEWER", T),
        body: { qtyOrderUnit: 5 },
      }),
      routeParams({ id: ownSuggestionId }),
    );
    expect(res.status).toBe(403);
  });

  it("PATCH ändert Menge des eigenen Vorschlags (USER)", async () => {
    const res = await PATCH(
      makeRequest(itemUrl(ownSuggestionId), {
        method: "PATCH",
        headers: await sessionHeaders("USER", T),
        body: { qtyOrderUnit: 5 },
      }),
      routeParams({ id: ownSuggestionId }),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{ data: { qtyOrderUnit: number } }>(res);
    expect(body.data.qtyOrderUnit).toBe(5);
  });

  it("PATCH auf Vorschlag eines fremden Mandanten liefert 404 und ändert nichts", async () => {
    const res = await PATCH(
      makeRequest(itemUrl(foreignSuggestionId), {
        method: "PATCH",
        headers: await sessionHeaders("USER", T),
        body: { qtyOrderUnit: 1 },
      }),
      routeParams({ id: foreignSuggestionId }),
    );
    expect(res.status).toBe(404);
    const row = await prisma.orderSuggestion.findUniqueOrThrow({ where: { id: foreignSuggestionId } });
    expect(row.qtyOrderUnit).toBe(9);
  });

  it("PATCH auf nicht mehr offenen Vorschlag liefert 409", async () => {
    const closed = await prisma.orderSuggestion.create({
      data: {
        tenantId: T,
        articleId: ownArticleId,
        qtyOrderUnit: 1,
        reason: "MANUAL_SCAN",
        status: "DISMISSED",
        createdBy: "seed",
      },
    });
    const res = await PATCH(
      makeRequest(itemUrl(closed.id), {
        method: "PATCH",
        headers: await sessionHeaders("USER", T),
        body: { qtyOrderUnit: 3 },
      }),
      routeParams({ id: closed.id }),
    );
    expect(res.status).toBe(409);
  });
});
