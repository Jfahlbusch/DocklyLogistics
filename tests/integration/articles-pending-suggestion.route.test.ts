import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { purgeAppendOnly } from "../helpers/purge-append-only";
import { makeRequest, sessionHeaders, readJson, routeParams } from "./helpers";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { email: "tester@dockly.de", id: "tester" } })),
}));

import { PUT } from "@/app/api/v1/articles/[id]/pending-suggestion/route";

const T = "test-int-pending-sug";
const OTHER = "test-int-pending-sug-other";
const url = (id: string) => `http://localhost/api/v1/articles/${id}/pending-suggestion`;

type Sug = { id: string; status: string; reason: string; qtyOrderUnit: number; note: string | null; supplierId: string | null; createdBy: string };
type Res = { data: Sug; capacityWarning: boolean };

let articleId = ""; // Bestand 120, maxStock 500, packFactor 25
let plainArticleId = ""; // ohne maxStock, mit primärem Lieferanten
let foreignArticleId = "";
let supplierId = "";

async function put(id: string, body: unknown, role = "USER", tenant = T) {
  return PUT(
    makeRequest(url(id), { method: "PUT", headers: await sessionHeaders(role, tenant), body }),
    routeParams({ id }),
  );
}
const pending = (id: string) =>
  prisma.orderSuggestion.findMany({ where: { articleId: id, status: "PENDING" } });

async function cleanup() {
  await purgeAppendOnly(prisma, { tenantIds: [T, OTHER] });
  await prisma.orderSuggestion.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.stockBalance.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.articleSupplier.deleteMany({ where: { article: { tenantId: { in: [T, OTHER] } } } });
  await prisma.article.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.storageLocation.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.supplier.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [T, OTHER] } } });
}

describe("PUT /api/v1/articles/{id}/pending-suggestion", () => {
  beforeAll(async () => {
    await cleanup();
    for (const t of [T, OTHER]) await prisma.tenant.create({ data: { id: t, name: t } });
    const base = {
      name: "Mehl",
      baseUnit: "KG" as const,
      orderUnit: "SACK" as const,
      packFactor: 25,
      barcodeSource: "SKU" as const,
      minStock: 0,
    };
    articleId = (await prisma.article.create({ data: { ...base, tenantId: T, sku: "PS-1", maxStock: 500 } })).id;
    plainArticleId = (await prisma.article.create({ data: { ...base, tenantId: T, sku: "PS-2" } })).id;
    foreignArticleId = (await prisma.article.create({ data: { ...base, tenantId: OTHER, sku: "PS-3" } })).id;
    const loc = await prisma.storageLocation.create({ data: { tenantId: T, code: "L1", name: "L1" } });
    // Bestand 120 über zwei Lagerplätze
    const loc2 = await prisma.storageLocation.create({ data: { tenantId: T, code: "L2", name: "L2" } });
    await prisma.stockBalance.create({ data: { tenantId: T, articleId, locationId: loc.id, quantity: 100 } });
    await prisma.stockBalance.create({ data: { tenantId: T, articleId, locationId: loc2.id, quantity: 20 } });
    supplierId = (
      await prisma.supplier.create({ data: { tenantId: T, name: "Lieferant", channel: "EMAIL", channelConfig: {} } })
    ).id;
    await prisma.articleSupplier.create({
      data: { articleId: plainArticleId, supplierId, purchasePrice: 1, isPrimary: true },
    });
  });

  afterAll(cleanup);

  it("401 ohne Auth", async () => {
    const res = await PUT(makeRequest(url(articleId), { method: "PUT", body: { qtyOrderUnit: 1 } }), routeParams({ id: articleId }));
    expect(res.status).toBe(401);
  });

  it("VIEWER liefert 403", async () => {
    expect((await put(articleId, { qtyOrderUnit: 1 }, "VIEWER")).status).toBe(403);
  });

  it("fremder Mandant liefert 404", async () => {
    expect((await put(foreignArticleId, { qtyOrderUnit: 1 })).status).toBe(404);
    expect(await pending(foreignArticleId)).toHaveLength(0);
  });

  it.each([[-1], [1.5], ["3"], [undefined]])("Menge %s liefert 422", async (q) => {
    const res = await put(articleId, q === undefined ? {} : { qtyOrderUnit: q });
    expect(res.status).toBe(422);
  });

  it("Notiz über 500 Zeichen liefert 422", async () => {
    expect((await put(articleId, { qtyOrderUnit: 1, note: "x".repeat(501) })).status).toBe(422);
  });

  it("ohne offenen Vorschlag: 201, genau ein PENDING/MANUAL_SCAN", async () => {
    const res = await put(plainArticleId, { qtyOrderUnit: 3, note: "Scan" });
    expect(res.status).toBe(201);
    const body = await readJson<Res>(res);
    expect(body.data).toMatchObject({ status: "PENDING", reason: "MANUAL_SCAN", qtyOrderUnit: 3, note: "Scan", supplierId, createdBy: "tester@dockly.de" });
    expect(body.capacityWarning).toBe(false);
    expect(await pending(plainArticleId)).toHaveLength(1);
    const audit = await prisma.auditLog.findMany({ where: { tenantId: T, entity: "OrderSuggestion", entityId: body.data.id } });
    expect(audit).toHaveLength(1);
  });

  it("Artikel ohne Lieferant: supplierId null", async () => {
    const res = await put(articleId, { qtyOrderUnit: 2 });
    expect(res.status).toBe(201);
    expect((await readJson<Res>(res)).data.supplierId).toBeNull();
  });

  it("mit offenem Vorschlag: 200, derselbe Datensatz, neue Menge, Grund MANUAL_SCAN", async () => {
    const [existing] = await pending(plainArticleId);
    await prisma.orderSuggestion.update({ where: { id: existing.id }, data: { reason: "AUTO_MIN_STOCK" } });
    const res = await put(plainArticleId, { qtyOrderUnit: 7, note: "neu" });
    expect(res.status).toBe(200);
    const body = await readJson<Res>(res);
    expect(body.data).toMatchObject({ id: existing.id, qtyOrderUnit: 7, reason: "MANUAL_SCAN", note: "neu" });
    expect(await pending(plainArticleId)).toHaveLength(1);
  });

  it("capacityWarning true bei 120 + 16×25 > 500, Vorschlag wird trotzdem gespeichert", async () => {
    const res = await put(articleId, { qtyOrderUnit: 16 });
    expect(res.status).toBe(200);
    const body = await readJson<Res>(res);
    expect(body.capacityWarning).toBe(true);
    expect(body.data.qtyOrderUnit).toBe(16);
    const [row] = await pending(articleId);
    expect(row.qtyOrderUnit).toBe(16);
    // innerhalb der Kapazität: keine Warnung
    const ok = await readJson<Res>(await put(articleId, { qtyOrderUnit: 15 }));
    expect(ok.capacityWarning).toBe(false);
  });

  it("Menge 0 mit offenem Vorschlag: 200 und DISMISSED", async () => {
    const [existing] = await pending(articleId);
    const res = await put(articleId, { qtyOrderUnit: 0 });
    expect(res.status).toBe(200);
    expect((await readJson<Res>(res)).data).toMatchObject({ id: existing.id, status: "DISMISSED" });
    expect(await pending(articleId)).toHaveLength(0);
  });

  it("Menge 0 ohne offenen Vorschlag: 204 ohne Body, nichts angelegt", async () => {
    const before = await prisma.orderSuggestion.count({ where: { articleId } });
    const res = await put(articleId, { qtyOrderUnit: 0 });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(await prisma.orderSuggestion.count({ where: { articleId } })).toBe(before);
  });

  it("gleichzeitige PUTs (2 und 8) erzeugen genau einen PENDING", async () => {
    for (const n of [2, 8]) {
      await prisma.orderSuggestion.deleteMany({ where: { articleId } });
      const rs = await Promise.all(Array.from({ length: n }, (_, i) => put(articleId, { qtyOrderUnit: i + 1 })));
      const codes = rs.map((r) => r.status);
      expect(codes.filter((c) => c === 201)).toHaveLength(1);
      expect(codes.filter((c) => c === 200)).toHaveLength(n - 1);
      expect(await pending(articleId)).toHaveLength(1);
    }
  });
});
