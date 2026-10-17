import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { makeRequest, sessionHeaders, readJson, routeParams } from "./helpers";

// PATCH schreibt einen Audit-Eintrag und braucht dafür eine Actor-Identität.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { email: "tester@dockly.de", id: "tester" } })),
}));

import { GET, PATCH, DELETE } from "@/app/api/v1/articles/[id]/route";

const T = "test-int-articles-id";
const OTHER = "test-int-articles-id-other";
const url = (id: string) => `http://localhost/api/v1/articles/${id}`;

let ownId = "";
let foreignId = "";

/**
 * Vorlage für dynamische Routen: der zweite Handler-Parameter kommt aus
 * `routeParams({ id })`. Die vier kanonischen Nachweise sind hier zusätzlich
 * um den wichtigsten Isolationsfall erweitert — eine fremde ID darf nicht
 * bloß leer, sondern gar nicht auffindbar sein (404 statt 200).
 */
/**
 * Räumt die Testtenants restlos ab. Läuft vor UND nach den Tests, damit ein
 * abgebrochener Lauf den nächsten nicht blockiert (Article hat unique(tenantId, sku)).
 */
async function cleanup() {
  // AuditLog ist append-only (DB-Trigger); fürs Test-Cleanup transient umgehen
  // — das dokumentierte Muster aus CLAUDE.md.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = 'replica';");
    await tx.auditLog.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  });
  await prisma.article.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [T, OTHER] } } });
}

describe("/api/v1/articles/[id]", () => {
  beforeAll(async () => {
    await cleanup();
    for (const t of [T, OTHER]) {
      await prisma.tenant.upsert({ where: { id: t }, update: {}, create: { id: t, name: t } });
    }
    const base = {
      name: "Test Artikel",
      baseUnit: "KG" as const,
      orderUnit: "SACK" as const,
      packFactor: 25,
      barcodeSource: "SKU" as const,
      minStock: 0,
    };
    ownId = (await prisma.article.create({ data: { ...base, tenantId: T, sku: "AID-1" } })).id;
    foreignId = (await prisma.article.create({ data: { ...base, tenantId: OTHER, sku: "AID-2" } })).id;
  });

  afterAll(cleanup);

  it("liefert 401 ohne Auth-Header", async () => {
    const res = await GET(makeRequest(url(ownId)), routeParams({ id: ownId }));
    expect(res.status).toBe(401);
  });

  it("liefert den eigenen Artikel (VIEWER)", async () => {
    const res = await GET(
      makeRequest(url(ownId), { headers: await sessionHeaders("VIEWER", T) }),
      routeParams({ id: ownId }),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{ data: { id: string; sku: string } }>(res);
    expect(body.data.sku).toBe("AID-1");
  });

  it("liefert 404 für einen Artikel eines fremden Tenants (Isolationsnachweis)", async () => {
    const res = await GET(
      makeRequest(url(foreignId), { headers: await sessionHeaders("VIEWER", T) }),
      routeParams({ id: foreignId }),
    );
    expect(res.status).toBe(404);
  });

  it("verweigert PATCH unterhalb der geforderten Rolle (VIEWER → 403)", async () => {
    const res = await PATCH(
      makeRequest(url(ownId), {
        method: "PATCH",
        headers: await sessionHeaders("VIEWER", T),
        body: { name: "Darf nicht durchgehen" },
      }),
      routeParams({ id: ownId }),
    );
    expect(res.status).toBe(403);
    const unchanged = await prisma.article.findUnique({ where: { id: ownId } });
    expect(unchanged?.name).toBe("Test Artikel");
  });

  it("ändert den eigenen Artikel als USER", async () => {
    const res = await PATCH(
      makeRequest(url(ownId), {
        method: "PATCH",
        headers: await sessionHeaders("USER", T),
        body: { name: "Umbenannt" },
      }),
      routeParams({ id: ownId }),
    );
    expect(res.status).toBe(200);
    const after = await prisma.article.findUnique({ where: { id: ownId } });
    expect(after?.name).toBe("Umbenannt");
  });

  it("ändert keinen fremden Artikel (404, Datensatz unangetastet)", async () => {
    const res = await PATCH(
      makeRequest(url(foreignId), {
        method: "PATCH",
        headers: await sessionHeaders("MANAGER", T),
        body: { name: "Fremdzugriff" },
      }),
      routeParams({ id: foreignId }),
    );
    expect(res.status).toBe(404);
    const foreign = await prisma.article.findUnique({ where: { id: foreignId } });
    expect(foreign?.name).toBe("Test Artikel");
  });

  it("löscht keinen fremden Artikel (404, Datensatz bleibt bestehen)", async () => {
    const res = await DELETE(
      makeRequest(url(foreignId), { method: "DELETE", headers: await sessionHeaders("MANAGER", T) }),
      routeParams({ id: foreignId }),
    );
    expect(res.status).toBe(404);
    expect(await prisma.article.findUnique({ where: { id: foreignId } })).not.toBeNull();
  });

  describe("Maximal- und empfohlene Menge (T2)", () => {
    const patch = async (role: "VIEWER" | "USER", body: unknown, id = ownId, tenant = T) =>
      PATCH(
        makeRequest(url(id), { method: "PATCH", headers: await sessionHeaders(role, tenant), body }),
        routeParams({ id }),
      );
    const reset = () =>
      prisma.article.update({ where: { id: ownId }, data: { minStock: 0, maxStock: null, targetStock: null } });

    it("setzt maxStock/targetStock (200) und liefert sie in GET", async () => {
      await reset();
      const res = await patch("USER", { maxStock: 500, targetStock: 300 });
      expect(res.status).toBe(200);
      const row = await prisma.article.findUnique({ where: { id: ownId } });
      expect(row?.maxStock).toBe(500);
      expect(row?.targetStock).toBe(300);
      const get = await GET(
        makeRequest(url(ownId), { headers: await sessionHeaders("VIEWER", T) }),
        routeParams({ id: ownId }),
      );
      const body = await readJson<{ data: { maxStock: number | null; targetStock: number | null } }>(get);
      expect(body.data.maxStock).toBe(500);
      expect(body.data.targetStock).toBe(300);
    });

    it("null löscht die Werte", async () => {
      await prisma.article.update({ where: { id: ownId }, data: { maxStock: 500, targetStock: 300 } });
      const res = await patch("USER", { maxStock: null, targetStock: null });
      expect(res.status).toBe(200);
      const row = await prisma.article.findUnique({ where: { id: ownId } });
      expect(row?.maxStock).toBeNull();
      expect(row?.targetStock).toBeNull();
    });

    it("targetStock < minStock → 422 mit Feldname", async () => {
      await reset();
      const res = await patch("USER", { minStock: 100, targetStock: 50 });
      expect(res.status).toBe(422);
      const body = await readJson<{ errors: Record<string, string[]> }>(res);
      expect(Object.keys(body.errors)).toContain("targetStock");
      expect((await prisma.article.findUnique({ where: { id: ownId } }))?.targetStock).toBeNull();
    });

    it("targetStock > maxStock → 422 mit Feldname", async () => {
      await reset();
      const res = await patch("USER", { targetStock: 600, maxStock: 500 });
      expect(res.status).toBe(422);
      expect(Object.keys((await readJson<{ errors: Record<string, string[]> }>(res)).errors)).toContain("targetStock");
    });

    it("minStock > maxStock → 422 mit Feldname", async () => {
      await reset();
      const res = await patch("USER", { minStock: 100, maxStock: 50 });
      expect(res.status).toBe(422);
      expect(Object.keys((await readJson<{ errors: Record<string, string[]> }>(res)).errors)).toContain("maxStock");
    });

    it("Teil-Update wird mit gespeicherten Werten geprüft (nur maxStock=50, gespeichert min=100 → 422)", async () => {
      await prisma.article.update({ where: { id: ownId }, data: { minStock: 100, maxStock: null, targetStock: null } });
      const res = await patch("USER", { maxStock: 50 });
      expect(res.status).toBe(422);
      expect(Object.keys((await readJson<{ errors: Record<string, string[]> }>(res)).errors)).toContain("maxStock");
      expect((await prisma.article.findUnique({ where: { id: ownId } }))?.maxStock).toBeNull();
    });

    it("negative Werte → 422", async () => {
      await reset();
      expect((await patch("USER", { maxStock: -1 })).status).toBe(422);
    });

    it("PATCH ohne minStock/barcodeSource lässt die gespeicherten Werte unverändert", async () => {
      await prisma.article.update({ where: { id: ownId }, data: { minStock: 40, barcodeSource: "EAN" } });
      expect((await patch("USER", { name: "Nur Name" })).status).toBe(200);
      const row = await prisma.article.findUnique({ where: { id: ownId } });
      expect(row?.minStock).toBe(40);
      expect(row?.barcodeSource).toBe("EAN");
      await prisma.article.update({ where: { id: ownId }, data: { barcodeSource: "SKU" } });
    });

    it("VIEWER → 403", async () => {
      await reset();
      expect((await patch("VIEWER", { maxStock: 10 })).status).toBe(403);
    });

    it("fremder Mandant → 404", async () => {
      expect((await patch("USER", { maxStock: 10 }, foreignId)).status).toBe(404);
      expect((await prisma.article.findUnique({ where: { id: foreignId } }))?.maxStock).toBeNull();
    });
  });
});
