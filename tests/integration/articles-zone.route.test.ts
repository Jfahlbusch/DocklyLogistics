import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { makeRequest, sessionHeaders, readJson, routeParams } from "./helpers";
import { purgeAppendOnly } from "../helpers/purge-append-only";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { email: "tester@dockly.de", id: "tester" } })),
}));

import { GET, POST } from "@/app/api/v1/articles/route";
import { GET as GET_ONE, PATCH } from "@/app/api/v1/articles/[id]/route";

const T = "test-int-articles-zone";
const OTHER = "test-int-articles-zone-other";
const LIST = "http://localhost/api/v1/articles";
const one = (id: string) => `http://localhost/api/v1/articles/${id}`;

let zoneA = "";
let zoneB = "";
let foreignZone = "";
let locA = "";
let locB = "";
let locNone = "";
let artPlain = "";
let artInA = "";
let foreignArt = "";

type Err = { errors?: Record<string, string[]> };
type Art = { id: string; zoneId: string | null; zone: { id: string; name: string } | null; defaultLocationId: string | null };

async function cleanup() {
  await purgeAppendOnly(prisma, { tenantIds: [T, OTHER] });
  await prisma.article.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.storageLocation.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.zone.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [T, OTHER] } } });
}

const base = { name: "Z-Artikel", baseUnit: "KG" as const, orderUnit: "SACK" as const, packFactor: 25, barcodeSource: "SKU" as const, minStock: 0 };

describe("Artikel: Zone", () => {
  beforeAll(async () => {
    await cleanup();
    for (const t of [T, OTHER]) await prisma.tenant.create({ data: { id: t, name: t } });
    zoneA = (await prisma.zone.create({ data: { tenantId: T, name: "Zone A" } })).id;
    zoneB = (await prisma.zone.create({ data: { tenantId: T, name: "Zone B" } })).id;
    foreignZone = (await prisma.zone.create({ data: { tenantId: OTHER, name: "Fremd" } })).id;
    locA = (await prisma.storageLocation.create({ data: { tenantId: T, code: "A-1", name: "A1", zoneId: zoneA } })).id;
    locB = (await prisma.storageLocation.create({ data: { tenantId: T, code: "B-1", name: "B1", zoneId: zoneB } })).id;
    locNone = (await prisma.storageLocation.create({ data: { tenantId: T, code: "N-1", name: "N1" } })).id;
    artPlain = (await prisma.article.create({ data: { ...base, tenantId: T, sku: "Z-1" } })).id;
    artInA = (await prisma.article.create({ data: { ...base, tenantId: T, sku: "Z-2", zoneId: zoneA } })).id;
    foreignArt = (await prisma.article.create({ data: { ...base, tenantId: OTHER, sku: "Z-3", zoneId: foreignZone } })).id;
  });
  afterAll(cleanup);

  const patch = async (id: string, body: unknown, role = "USER") =>
    PATCH(makeRequest(one(id), { method: "PATCH", headers: await sessionHeaders(role, T), body }), routeParams({ id }));
  const post = async (body: Record<string, unknown>) =>
    POST(makeRequest(LIST, { method: "POST", headers: await sessionHeaders("USER", T), body: { ...base, ...body } }));

  it("PATCH: Zone A + Lagerplatz aus Zone B -> 422 am Feld defaultLocationId", async () => {
    const res = await patch(artPlain, { zoneId: zoneA, defaultLocationId: locB });
    expect(res.status).toBe(422);
    const b = await readJson<Err>(res);
    expect(b.errors?.defaultLocationId?.[0]).toMatch(/andere[nr]? Zone/);
  });

  it("PATCH: nur Zone ändern, gespeicherter Lagerplatz aus anderer Zone -> 422 (Zusammenführen)", async () => {
    const a = (await prisma.article.create({ data: { ...base, tenantId: T, sku: "Z-M", zoneId: zoneB, defaultLocationId: locB } })).id;
    const res = await patch(a, { zoneId: zoneA });
    expect(res.status).toBe(422);
    expect((await readJson<Err>(res)).errors?.defaultLocationId).toBeTruthy();
  });

  it("PATCH: fremde Zone -> 422 am Feld zoneId", async () => {
    const res = await patch(artPlain, { zoneId: foreignZone });
    expect(res.status).toBe(422);
    expect((await readJson<Err>(res)).errors?.zoneId).toBeTruthy();
  });

  it("PATCH: unbekannte Zone-ID (kein cuid) -> 422 am Feld zoneId", async () => {
    const res = await patch(artPlain, { zoneId: "gibt-es-nicht" });
    expect(res.status).toBe(422);
    expect((await readJson<Err>(res)).errors?.zoneId).toBeTruthy();
  });

  it("PATCH: Lagerplatz ohne zoneId-Angabe setzt die Zone automatisch", async () => {
    const res = await patch(artPlain, { defaultLocationId: locB });
    expect(res.status).toBe(200);
    const b = await readJson<{ data: Art }>(res);
    expect(b.data.zoneId).toBe(zoneB);
    expect(b.data.zone).toEqual({ id: zoneB, name: "Zone B" });
  });

  it("PATCH: Lagerplatz ohne Zone lässt die Zone unverändert", async () => {
    const res = await patch(artInA, { defaultLocationId: locNone });
    expect(res.status).toBe(200);
    expect((await readJson<{ data: Art }>(res)).data.zoneId).toBe(zoneA);
  });

  it("PATCH: passende Kombination und zoneId null löscht die Zone", async () => {
    const ok1 = await patch(artInA, { zoneId: zoneA, defaultLocationId: locA });
    expect(ok1.status).toBe(200);
    const cleared = await patch(artInA, { zoneId: null, defaultLocationId: null });
    expect(cleared.status).toBe(200);
    const b = await readJson<{ data: Art }>(cleared);
    expect(b.data.zoneId).toBeNull();
    expect(b.data.zone).toBeNull();
  });

  it("PATCH: VIEWER -> 403", async () => {
    expect((await patch(artPlain, { zoneId: zoneA }, "VIEWER")).status).toBe(403);
  });

  it("POST: Zone + passender Lagerplatz -> 201 mit zone-Objekt", async () => {
    const res = await post({ sku: "P-1", zoneId: zoneA, defaultLocationId: locA });
    expect(res.status).toBe(201);
    const b = await readJson<{ data: Art }>(res);
    expect(b.data.zone).toEqual({ id: zoneA, name: "Zone A" });
  });

  it("POST: fremde Zone -> 422 zoneId; Lagerplatz anderer Zone -> 422 defaultLocationId", async () => {
    const r1 = await post({ sku: "P-2", zoneId: foreignZone });
    expect(r1.status).toBe(422);
    expect((await readJson<Err>(r1)).errors?.zoneId).toBeTruthy();
    const r2 = await post({ sku: "P-3", zoneId: zoneA, defaultLocationId: locB });
    expect(r2.status).toBe(422);
    expect((await readJson<Err>(r2)).errors?.defaultLocationId).toBeTruthy();
  });

  it("POST: Lagerplatz ohne zoneId setzt die Zone automatisch", async () => {
    const res = await post({ sku: "P-4", defaultLocationId: locB });
    expect(res.status).toBe(201);
    expect((await readJson<{ data: Art }>(res)).data.zoneId).toBe(zoneB);
  });

  it("GET Detail liefert zone (Objekt oder null)", async () => {
    const h = await sessionHeaders("VIEWER", T);
    const withZone = await readJson<{ data: Art }>(await GET_ONE(makeRequest(one(artInA), { headers: h }), routeParams({ id: artInA })));
    expect(withZone.data).toHaveProperty("zone");
    const without = await readJson<{ data: Art }>(await GET_ONE(makeRequest(one(artPlain), { headers: h }), routeParams({ id: artPlain })));
    expect(without.data.zone === null || typeof without.data.zone === "object").toBe(true);
  });

  it("Liste: Filter zoneId liefert nur Artikel der Zone des eigenen Mandanten", async () => {
    await prisma.article.update({ where: { id: artInA }, data: { zoneId: zoneA } });
    const h = await sessionHeaders("VIEWER", T);
    const res = await GET(makeRequest(`${LIST}?zoneId=${zoneA}`, { headers: h }));
    expect(res.status).toBe(200);
    const b = await readJson<{ data: Art[]; meta: { total: number } }>(res);
    expect(b.data.length).toBeGreaterThan(0);
    expect(b.data.every((a) => a.zoneId === zoneA && a.zone?.name === "Zone A")).toBe(true);
    expect(b.data.some((a) => a.id === foreignArt)).toBe(false);
    // fremde Zone-ID liefert beim eigenen Mandanten nichts
    const foreign = await readJson<{ data: Art[] }>(await GET(makeRequest(`${LIST}?zoneId=${foreignZone}`, { headers: h })));
    expect(foreign.data).toHaveLength(0);
  });
});
