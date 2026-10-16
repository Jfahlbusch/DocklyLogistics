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
});
