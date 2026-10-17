import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { purgeAppendOnly } from "../helpers/purge-append-only";
import { makeRequest, sessionHeaders, readJson, routeParams } from "./helpers";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { email: "tester@dockly.de", id: "tester" } })),
}));

import { GET } from "@/app/api/v1/zones/[id]/walk/route";

const T = "test-int-zones-walk";
const OTHER = "test-int-zones-walk-other";
let zoneId = "", otherZoneId = "", emptyZoneId = "", foreignZoneId = "";

type Item = {
  article: { id: string; sku: string; name: string; baseUnit: string; orderUnit: string; packFactor: number; minStock: number; targetStock: number | null; maxStock: number | null };
  location: { id: string; code: string; name: string } | null;
  stockTotal: number;
  suggestedQty: number;
  pendingSuggestion: { id: string; qtyOrderUnit: number } | null;
};
type Walk = { data: { zone: { id: string; name: string }; items: Item[] } };

async function cleanup() {
  await purgeAppendOnly(prisma, { tenantIds: [T, OTHER] });
  await prisma.orderSuggestion.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.article.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.storageLocation.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.zone.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [T, OTHER] } } });
}
const get = async (id: string, role = "VIEWER") =>
  GET(makeRequest(`http://localhost/api/v1/zones/${id}/walk`, { headers: await sessionHeaders(role, T) }), routeParams({ id }));

const art = (tenantId: string, sku: string, name: string, extra: Record<string, unknown> = {}) =>
  prisma.article.create({ data: { tenantId, sku, name, baseUnit: "PIECE", orderUnit: "BOX", packFactor: 1, ...extra } });

describe("GET /api/v1/zones/{id}/walk", () => {
  beforeAll(async () => {
    await cleanup();
    for (const t of [T, OTHER]) await prisma.tenant.create({ data: { id: t, name: t } });
    zoneId = (await prisma.zone.create({ data: { tenantId: T, name: "Trocken" } })).id;
    otherZoneId = (await prisma.zone.create({ data: { tenantId: T, name: "Kühl" } })).id;
    emptyZoneId = (await prisma.zone.create({ data: { tenantId: T, name: "Leer" } })).id;
    foreignZoneId = (await prisma.zone.create({ data: { tenantId: OTHER, name: "Fremd" } })).id;

    const loc = (code: string) => prisma.storageLocation.create({ data: { tenantId: T, code, name: `Platz ${code}` } });
    const a2 = await loc("A-2"), a10 = await loc("A-10"), b1 = await loc("B-1");
    const foreignLoc = await prisma.storageLocation.create({ data: { tenantId: OTHER, code: "A-1", name: "Fremdplatz" } });

    await art(T, "S-ZED", "Zucker", { zoneId, defaultLocationId: a10.id });
    await art(T, "S-ALPHA", "Anis", { zoneId, defaultLocationId: a2.id });
    await art(T, "S-MEHL", "Mehl", {
      zoneId, defaultLocationId: a2.id, packFactor: 25, minStock: 100, targetStock: 300, maxStock: 500,
    });
    await art(T, "S-NOLOC-B", "Zimt", { zoneId });
    await art(T, "S-NOLOC-A", "Backpulver", { zoneId });
    await art(T, "S-B", "Salz", { zoneId, defaultLocationId: b1.id });
    await art(T, "S-INACTIVE", "Inaktiv", { zoneId, defaultLocationId: a2.id, active: false });
    await art(T, "S-OTHERZONE", "Milch", { zoneId: otherZoneId, defaultLocationId: a2.id });
    await art(OTHER, "S-FOREIGN", "Fremdartikel", { zoneId: foreignZoneId, defaultLocationId: foreignLoc.id });

    const mehl = await prisma.article.findFirstOrThrow({ where: { tenantId: T, sku: "S-MEHL" } });
    // Bestand 120 verteilt auf zwei Lagerplätze
    await prisma.stockBalance.create({ data: { tenantId: T, articleId: mehl.id, locationId: a2.id, quantity: 70 } });
    await prisma.stockBalance.create({ data: { tenantId: T, articleId: mehl.id, locationId: b1.id, quantity: 50 } });
    await prisma.orderSuggestion.create({ data: { tenantId: T, articleId: mehl.id, qtyOrderUnit: 3, reason: "MANUAL_SCAN", status: "DISMISSED", createdBy: "t" } });
    await prisma.orderSuggestion.create({ data: { tenantId: T, articleId: mehl.id, qtyOrderUnit: 5, reason: "MANUAL_SCAN", status: "PENDING", createdBy: "t" } });
  });
  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

  it("401 ohne Auth", async () => {
    const res = await GET(makeRequest(`http://localhost/api/v1/zones/${zoneId}/walk`), routeParams({ id: zoneId }));
    expect(res.status).toBe(401);
  });

  it("200 für VIEWER, Zone im Antwortkopf", async () => {
    const res = await get(zoneId, "VIEWER");
    expect(res.status).toBe(200);
    expect((await readJson<Walk>(res)).data.zone).toEqual({ id: zoneId, name: "Trocken" });
  });

  it("Reihenfolge: Lagerplatz natürlich (A-2 vor A-10), dann Name; ohne Lagerplatz zuletzt", async () => {
    const { data } = await readJson<Walk>(await get(zoneId));
    expect(data.items.map((i) => i.article.name)).toEqual(["Anis", "Mehl", "Zucker", "Salz", "Backpulver", "Zimt"]);
    expect(data.items.map((i) => i.location?.code ?? null)).toEqual(["A-2", "A-2", "A-10", "B-1", null, null]);
    expect(data.items[0].location).toMatchObject({ code: "A-2", name: "Platz A-2" });
    expect(data.items[0].location?.id).toBeTruthy();
  });

  it("inaktive, fremde Zone und fremder Mandant fehlen", async () => {
    const { data } = await readJson<Walk>(await get(zoneId));
    const skus = data.items.map((i) => i.article.sku);
    expect(skus).not.toContain("S-INACTIVE");
    expect(skus).not.toContain("S-OTHERZONE");
    expect(skus).not.toContain("S-FOREIGN");
    expect(skus).toHaveLength(6);
  });

  it("stockTotal und suggestedQty (Ziel 300, Bestand 120, packFactor 25 → 8)", async () => {
    const { data } = await readJson<Walk>(await get(zoneId));
    const mehl = data.items.find((i) => i.article.sku === "S-MEHL")!;
    expect(mehl.stockTotal).toBe(120);
    expect(mehl.suggestedQty).toBe(8);
    expect(mehl.article).toMatchObject({ baseUnit: "PIECE", orderUnit: "BOX", packFactor: 25, minStock: 100, targetStock: 300, maxStock: 500 });
    const anis = data.items.find((i) => i.article.sku === "S-ALPHA")!;
    expect(anis.stockTotal).toBe(0);
  });

  it("pendingSuggestion nur für PENDING, sonst null", async () => {
    const { data } = await readJson<Walk>(await get(zoneId));
    const mehl = data.items.find((i) => i.article.sku === "S-MEHL")!;
    expect(mehl.pendingSuggestion).toEqual({ id: expect.any(String), qtyOrderUnit: 5 });
    expect(data.items.find((i) => i.article.sku === "S-ALPHA")!.pendingSuggestion).toBeNull();
  });

  it("404 für fremde und unbekannte Zone", async () => {
    expect((await get(foreignZoneId)).status).toBe(404);
    expect((await get("gibtsnicht")).status).toBe(404);
  });

  it("leere Zone → items []", async () => {
    const res = await get(emptyZoneId);
    expect(res.status).toBe(200);
    expect((await readJson<Walk>(res)).data.items).toEqual([]);
  });
});
