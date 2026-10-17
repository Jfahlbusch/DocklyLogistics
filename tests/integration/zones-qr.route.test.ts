import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { purgeAppendOnly } from "../helpers/purge-append-only";
import { makeRequest, sessionHeaders, routeParams } from "./helpers";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { email: "tester@dockly.de", id: "tester" } })),
}));

import { GET } from "@/app/api/v1/zones/[id]/qr/route";

const T = "test-int-zones-qr";
const OTHER = "test-int-zones-qr-other";
let ownId = "";
let foreignId = "";

async function cleanup() {
  await purgeAppendOnly(prisma, { tenantIds: [T, OTHER] });
  await prisma.zone.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [T, OTHER] } } });
}
const get = async (id: string, role = "VIEWER") =>
  GET(makeRequest(`http://localhost/api/v1/zones/${id}/qr`, { headers: await sessionHeaders(role, T) }), routeParams({ id }));

describe("GET /api/v1/zones/{id}/qr", () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://logistics.dockly.de/";
    await cleanup();
    for (const t of [T, OTHER]) await prisma.tenant.create({ data: { id: t, name: t } });
    ownId = (await prisma.zone.create({ data: { tenantId: T, name: "Trocken" } })).id;
    foreignId = (await prisma.zone.create({ data: { tenantId: OTHER, name: "Fremd" } })).id;
  });
  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

  it("401 ohne Auth", async () => {
    const res = await GET(makeRequest(`http://localhost/api/v1/zones/${ownId}/qr`), routeParams({ id: ownId }));
    expect(res.status).toBe(401);
  });
  it("200 image/svg+xml für die eigene Zone (VIEWER), mit Cache-Header", async () => {
    const res = await get(ownId);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");
    expect(res.headers.get("cache-control")).toBe("private, max-age=300");
    expect(await res.text()).toContain("<svg");
  });
  it("404 für fremde und unbekannte Zone", async () => {
    expect((await get(foreignId)).status).toBe(404);
    expect((await get("gibtsnicht")).status).toBe(404);
  });
  it("500 ohne konfigurierte Basis-URL (keine Host-Header-Übernahme)", async () => {
    const a = process.env.NEXT_PUBLIC_APP_URL, b = process.env.NEXTAUTH_URL;
    delete process.env.NEXT_PUBLIC_APP_URL; delete process.env.NEXTAUTH_URL;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await get(ownId)).status).toBe(500);
      expect(err.mock.calls.flat().join(" ")).toContain("NEXT_PUBLIC_APP_URL");
    } finally {
      err.mockRestore();
      process.env.NEXT_PUBLIC_APP_URL = a; if (b !== undefined) process.env.NEXTAUTH_URL = b;
    }
  });
  it("Fallback auf NEXTAUTH_URL", async () => {
    const a = process.env.NEXT_PUBLIC_APP_URL, b = process.env.NEXTAUTH_URL;
    delete process.env.NEXT_PUBLIC_APP_URL; process.env.NEXTAUTH_URL = "https://fallback.example";
    try {
      expect((await get(ownId)).status).toBe(200);
    } finally {
      process.env.NEXT_PUBLIC_APP_URL = a; if (b !== undefined) process.env.NEXTAUTH_URL = b; else delete process.env.NEXTAUTH_URL;
    }
  });
});
