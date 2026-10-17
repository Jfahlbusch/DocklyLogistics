import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { purgeAppendOnly } from "../helpers/purge-append-only";
import { makeRequest, sessionHeaders, readJson, routeParams } from "./helpers";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { email: "tester@dockly.de", id: "tester" } })),
}));

import { GET as LIST, POST } from "@/app/api/v1/zones/route";
import { GET, PATCH, DELETE } from "@/app/api/v1/zones/[id]/route";
import { GET as LOC_LIST, POST as LOC_POST } from "@/app/api/v1/locations/route";
import { PATCH as LOC_PATCH } from "@/app/api/v1/locations/[id]/route";
import { GET as SEARCH } from "@/app/api/v1/search/route";

const T = "test-int-zones";
const OTHER = "test-int-zones-other";
const base = "http://localhost/api/v1/zones";

type Z = { id: string; name: string; sortOrder: number; locationCount?: number; articleCount?: number };

async function cleanup() {
  await purgeAppendOnly(prisma, { tenantIds: [T, OTHER] });
  await prisma.article.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.storageLocation.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.zone.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [T, OTHER] } } });
}

const call = async (fn: (...a: never[]) => Promise<Response>, url: string, role: string, tenant: string, opts: { method?: string; body?: unknown } = {}, id?: string) =>
  (fn as (r: unknown, c?: unknown) => Promise<Response>)(
    makeRequest(url, { method: opts.method, body: opts.body, headers: await sessionHeaders(role, tenant) }),
    id ? routeParams({ id }) : undefined,
  );

let foreignZoneId = "";

describe("/api/v1/zones", () => {
  beforeAll(async () => {
    await cleanup();
    for (const t of [T, OTHER]) await prisma.tenant.create({ data: { id: t, name: t } });
    foreignZoneId = (await prisma.zone.create({ data: { tenantId: OTHER, name: "Fremdzone Kühl" } })).id;
  });
  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

  it("401 ohne Auth", async () => {
    expect((await LIST(makeRequest(base))).status).toBe(401);
    expect((await POST(makeRequest(base, { method: "POST", body: { name: "X" } }))).status).toBe(401);
  });

  it("403 beim Schreiben als USER/VIEWER", async () => {
    for (const role of ["USER", "VIEWER"]) {
      const res = await call(POST, base, role, T, { method: "POST", body: { name: "Nope" } });
      expect(res.status).toBe(403);
    }
  });

  it("POST legt an (201), doppelter Name → 409, ungültig → 422", async () => {
    const res = await call(POST, base, "MANAGER", T, { method: "POST", body: { name: "Kühlraum", sortOrder: 2 } });
    expect(res.status).toBe(201);
    const b = await readJson<{ data: Z }>(res);
    expect(b.data.name).toBe("Kühlraum");
    expect(b.data.sortOrder).toBe(2);
    expect((await call(POST, base, "MANAGER", T, { method: "POST", body: { name: "Kühlraum" } })).status).toBe(409);
    expect((await call(POST, base, "MANAGER", T, { method: "POST", body: { name: "" } })).status).toBe(422);
    // gleicher Name in anderem Mandanten ist erlaubt
    expect((await call(POST, base, "MANAGER", OTHER, { method: "POST", body: { name: "Kühlraum" } })).status).toBe(201);
    const audit = await prisma.auditLog.count({ where: { tenantId: T, entity: "Zone", action: "CREATE" } });
    expect(audit).toBe(1);
  });

  it("GET liefert sortierte Liste mit Zählern, nur eigener Mandant", async () => {
    await call(POST, base, "MANAGER", T, { method: "POST", body: { name: "Trocken", sortOrder: 1 } });
    const kuehl = await prisma.zone.findFirstOrThrow({ where: { tenantId: T, name: "Kühlraum" } });
    await prisma.storageLocation.create({ data: { tenantId: T, code: "L1", name: "L1", zoneId: kuehl.id } });
    const res = await call(LIST, base, "VIEWER", T);
    expect(res.status).toBe(200);
    const b = await readJson<{ data: Z[] }>(res);
    expect(b.data.map((z) => z.name)).toEqual(["Trocken", "Kühlraum"]);
    expect(b.data.find((z) => z.name === "Kühlraum")).toMatchObject({ locationCount: 1, articleCount: 0 });
    expect(b.data.some((z) => z.id === foreignZoneId)).toBe(false);
  });

  it("GET/PATCH/DELETE auf fremde Zone → 404", async () => {
    expect((await call(GET, `${base}/${foreignZoneId}`, "VIEWER", T, {}, foreignZoneId)).status).toBe(404);
    expect((await call(PATCH, `${base}/${foreignZoneId}`, "MANAGER", T, { method: "PATCH", body: { name: "Hack" } }, foreignZoneId)).status).toBe(404);
    expect((await call(DELETE, `${base}/${foreignZoneId}`, "MANAGER", T, { method: "DELETE" }, foreignZoneId)).status).toBe(404);
    expect(await prisma.zone.count({ where: { id: foreignZoneId } })).toBe(1);
  });

  it("GET Detail, PATCH (Umbenennen, 409 bei Duplikat, 403 USER)", async () => {
    const z = await prisma.zone.findFirstOrThrow({ where: { tenantId: T, name: "Trocken" } });
    expect((await call(GET, `${base}/${z.id}`, "VIEWER", T, {}, z.id)).status).toBe(200);
    expect((await call(PATCH, `${base}/${z.id}`, "USER", T, { method: "PATCH", body: { name: "X" } }, z.id)).status).toBe(403);
    expect((await call(PATCH, `${base}/${z.id}`, "MANAGER", T, { method: "PATCH", body: { name: "Kühlraum" } }, z.id)).status).toBe(409);
    const ok = await call(PATCH, `${base}/${z.id}`, "MANAGER", T, { method: "PATCH", body: { name: "Trockenlager", active: false } }, z.id);
    expect(ok.status).toBe(200);
    expect((await readJson<{ data: Z }>(ok)).data.name).toBe("Trockenlager");
    expect(await prisma.auditLog.count({ where: { tenantId: T, entity: "Zone", action: "UPDATE" } })).toBe(1);
  });

  it("DELETE: mit Lagerplätzen → 409, mit Artikeln → 409, leer → 204", async () => {
    const kuehl = await prisma.zone.findFirstOrThrow({ where: { tenantId: T, name: "Kühlraum" } });
    expect((await call(DELETE, `${base}/${kuehl.id}`, "MANAGER", T, { method: "DELETE" }, kuehl.id)).status).toBe(409);

    const art = await prisma.zone.create({ data: { tenantId: T, name: "NurArtikel" } });
    await prisma.article.create({ data: { tenantId: T, sku: "ZA-1", name: "ZA", baseUnit: "KG", orderUnit: "SACK", packFactor: 1, barcodeSource: "SKU", minStock: 0, zoneId: art.id } });
    expect((await call(DELETE, `${base}/${art.id}`, "MANAGER", T, { method: "DELETE" }, art.id)).status).toBe(409);

    const empty = await prisma.zone.create({ data: { tenantId: T, name: "Leer" } });
    expect((await call(DELETE, `${base}/${empty.id}`, "USER", T, { method: "DELETE" }, empty.id)).status).toBe(403);
    expect((await call(DELETE, `${base}/${empty.id}`, "MANAGER", T, { method: "DELETE" }, empty.id)).status).toBe(204);
    expect(await prisma.zone.count({ where: { id: empty.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { tenantId: T, entity: "Zone", action: "DELETE" } })).toBe(1);
  });
});

describe("/api/v1/locations mit zoneId", () => {
  const lurl = "http://localhost/api/v1/locations";
  beforeAll(async () => {
    await cleanup();
    for (const t of [T, OTHER]) await prisma.tenant.create({ data: { id: t, name: t } });
    foreignZoneId = (await prisma.zone.create({ data: { tenantId: OTHER, name: "Fremdzone" } })).id;
  });
  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

  it("fremde zoneId → 422 bei POST und PATCH", async () => {
    const res = await call(LOC_POST, lurl, "MANAGER", T, { method: "POST", body: { code: "Z-1", name: "Z1", zoneId: foreignZoneId } });
    expect(res.status).toBe(422);
    expect(await prisma.storageLocation.count({ where: { tenantId: T } })).toBe(0);

    const loc = await prisma.storageLocation.create({ data: { tenantId: T, code: "Z-2", name: "Z2" } });
    const p = await call(LOC_PATCH, `${lurl}/${loc.id}`, "MANAGER", T, { method: "PATCH", body: { zoneId: foreignZoneId } }, loc.id);
    expect(p.status).toBe(422);
  });

  it("eigene zoneId wird gespeichert; Antwort liefert zone = Zonenname; Freitext wird ignoriert", async () => {
    const zone = await prisma.zone.create({ data: { tenantId: T, name: "Kühlraum" } });
    const res = await call(LOC_POST, lurl, "MANAGER", T, { method: "POST", body: { code: "Z-3", name: "Z3", zoneId: zone.id, zone: "Freitext" } });
    expect(res.status).toBe(201);
    const b = await readJson<{ data: { id: string; zone: string | null; zoneId: string | null } }>(res);
    expect(b.data.zoneId).toBe(zone.id);
    expect(b.data.zone).toBe("Kühlraum");
    expect((await prisma.storageLocation.findUniqueOrThrow({ where: { id: b.data.id } })).zone).toBeNull();

    const list = await call(LOC_LIST, lurl, "VIEWER", T);
    const items = (await readJson<{ data: Array<{ code: string; zone: string | null }> }>(list)).data;
    expect(items.find((l) => l.code === "Z-3")?.zone).toBe("Kühlraum");

    // zoneId null entfernt die Zuordnung
    const p = await call(LOC_PATCH, `${lurl}/${b.data.id}`, "MANAGER", T, { method: "PATCH", body: { zoneId: null } }, b.data.id);
    expect(p.status).toBe(200);
    expect((await readJson<{ data: { zone: string | null; zoneId: string | null } }>(p)).data.zoneId).toBeNull();
  });

  it("Fallback auf alten Freitext, wenn keine Zone verknüpft", async () => {
    await prisma.storageLocation.create({ data: { tenantId: T, code: "OLD", name: "Old", zone: "Altzone" } });
    const list = await call(LOC_LIST, lurl, "VIEWER", T);
    const items = (await readJson<{ data: Array<{ code: string; zone: string | null }> }>(list)).data;
    expect(items.find((l) => l.code === "OLD")?.zone).toBe("Altzone");
  });
});

describe("GET /api/v1/search – Zonen", () => {
  beforeAll(async () => {
    await cleanup();
    for (const t of [T, OTHER]) await prisma.tenant.create({ data: { id: t, name: t } });
    await prisma.zone.create({ data: { tenantId: T, name: "Zonensuche Eigen" } });
    await prisma.zone.create({ data: { tenantId: OTHER, name: "Zonensuche Fremd" } });
  });
  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

  it("findet nur Zonen des eigenen Mandanten, Gruppe zones, Deep-Link", async () => {
    const res = await SEARCH(makeRequest("http://localhost/api/v1/search?q=Zonensuche", { headers: await sessionHeaders("VIEWER", T) }));
    const b = await readJson<{ data: { groups: Array<{ key: string; items: Array<{ id: string; title: string; href: string }> }> } }>(res);
    const g = b.data.groups.find((x) => x.key === "zones");
    expect(g?.items.map((i) => i.title)).toEqual(["Zonensuche Eigen"]);
    expect(g?.items[0].href).toBe(`/stock?tab=zones&open=${g?.items[0].id}`);
  });
});
