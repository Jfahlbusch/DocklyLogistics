import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { makeRequest, sessionHeaders, readJson, routeParams } from "./helpers";
import { purgeAppendOnly } from "../helpers/purge-append-only";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { email: "tester@dockly.de", id: "tester" } })),
}));

import { POST } from "@/app/api/v1/articles/route";
import { PATCH } from "@/app/api/v1/articles/[id]/route";

const T = "test-int-art-loc-tenant";
const OTHER = "test-int-art-loc-tenant-other";
let ownLoc = "";
let foreignLoc = "";
let artId = "";

async function cleanup() {
  await purgeAppendOnly(prisma, { tenantIds: [T, OTHER] });
  await prisma.article.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.storageLocation.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [T, OTHER] } } });
}

const base = { name: "L-Artikel", baseUnit: "KG" as const, orderUnit: "SACK" as const, packFactor: 25 };

describe("Artikel: defaultLocationId nur aus eigenem Mandanten", () => {
  beforeAll(async () => {
    await cleanup();
    for (const t of [T, OTHER]) await prisma.tenant.create({ data: { id: t, name: t } });
    ownLoc = (await prisma.storageLocation.create({ data: { tenantId: T, code: "L-1", name: "L1" } })).id;
    foreignLoc = (await prisma.storageLocation.create({ data: { tenantId: OTHER, code: "L-2", name: "L2" } })).id;
    artId = (await prisma.article.create({ data: { ...base, tenantId: T, sku: "LT-1", minStock: 0 } })).id;
  });
  afterAll(cleanup);

  it("POST: fremder Lagerplatz -> 422 defaultLocationId", async () => {
    const res = await POST(makeRequest("http://localhost/api/v1/articles", {
      method: "POST", headers: await sessionHeaders("USER", T), body: { ...base, sku: "LT-2", defaultLocationId: foreignLoc },
    }));
    expect(res.status).toBe(422);
    expect((await readJson<{ errors?: Record<string, string[]> }>(res)).errors?.defaultLocationId).toBeTruthy();
  });

  it("PATCH: fremder Lagerplatz -> 422 defaultLocationId", async () => {
    const res = await PATCH(
      makeRequest(`http://localhost/api/v1/articles/${artId}`, {
        method: "PATCH", headers: await sessionHeaders("USER", T), body: { defaultLocationId: foreignLoc },
      }),
      routeParams({ id: artId }),
    );
    expect(res.status).toBe(422);
    expect((await readJson<{ errors?: Record<string, string[]> }>(res)).errors?.defaultLocationId).toBeTruthy();
  });

  it("PATCH: eigener Lagerplatz -> 200", async () => {
    const res = await PATCH(
      makeRequest(`http://localhost/api/v1/articles/${artId}`, {
        method: "PATCH", headers: await sessionHeaders("USER", T), body: { defaultLocationId: ownLoc },
      }),
      routeParams({ id: artId }),
    );
    expect(res.status).toBe(200);
  });
});
