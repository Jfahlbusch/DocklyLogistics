import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db/client";
import { migrateZoneTexts, zoneTextMigrationSql } from "../helpers/migrate-zone-text";

const T = "test-zone-mig";
const OTHER = "test-zone-mig-other";

async function cleanup() {
  await prisma.article.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.storageLocation.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.zone.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [T, OTHER] } } });
}

const art = (tenantId: string, sku: string, defaultLocationId?: string) => ({
  tenantId, sku, name: sku, baseUnit: "KG" as const, orderUnit: "SACK" as const, packFactor: 1,
  barcodeSource: "SKU" as const, minStock: 0, defaultLocationId,
});

describe("Datenmigration Freitext-Zonen", () => {
  beforeAll(async () => {
    await cleanup();
    for (const t of [T, OTHER]) await prisma.tenant.create({ data: { id: t, name: t } });
    const mk = (tenantId: string, code: string, zone: string | null) =>
      prisma.storageLocation.create({ data: { tenantId, code, name: code, zone } });
    const k1 = await mk(T, "K1", "Kühlraum");
    await mk(T, "K2", " Kühlraum ");
    await mk(T, "T1", "Trocken");
    await mk(T, "E1", "   ");
    await mk(T, "N1", null);
    const o1 = await mk(OTHER, "O1", "Kühlraum");
    await prisma.article.create({ data: art(T, "A-K", k1.id) });
    await prisma.article.create({ data: art(T, "A-NONE") });
    await prisma.article.create({ data: art(OTHER, "A-O", o1.id) });
    // Inkonsistenter Altbestand: Artikel verweist auf den Lagerplatz eines FREMDEN Mandanten.
    await prisma.article.create({ data: art(T, "A-FOREIGN-LOC", o1.id) });
  });
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("legt je Mandant eindeutige Zonen an, verknüpft Lagerplätze und vererbt an Artikel", async () => {
    await prisma.$transaction((tx) => migrateZoneTexts(tx, T));

    const zones = await prisma.zone.findMany({ where: { tenantId: T }, orderBy: { name: "asc" } });
    expect(zones.map((z) => z.name)).toEqual(["Kühlraum", "Trocken"]);
    expect(zones[0].id).toMatch(/^z[0-9a-f]{32}$/);

    const locs = await prisma.storageLocation.findMany({ where: { tenantId: T } });
    const byCode = Object.fromEntries(locs.map((l) => [l.code, l.zoneId]));
    const kuehl = zones.find((z) => z.name === "Kühlraum")!.id;
    expect(byCode.K1).toBe(kuehl);
    expect(byCode.K2).toBe(kuehl);
    expect(byCode.T1).toBe(zones.find((z) => z.name === "Trocken")!.id);
    expect(byCode.E1).toBeNull();
    expect(byCode.N1).toBeNull();

    const arts = await prisma.article.findMany({ where: { tenantId: T } });
    expect(arts.find((a) => a.sku === "A-K")!.zoneId).toBe(kuehl);
    expect(arts.find((a) => a.sku === "A-NONE")!.zoneId).toBeNull();
  });

  it("lässt andere Mandanten unberührt (bei Mandantenbegrenzung)", async () => {
    expect(await prisma.zone.count({ where: { tenantId: OTHER } })).toBe(0);
    const o = await prisma.storageLocation.findFirstOrThrow({ where: { tenantId: OTHER } });
    expect(o.zoneId).toBeNull();
    expect((await prisma.article.findFirstOrThrow({ where: { tenantId: OTHER } })).zoneId).toBeNull();
  });

  it("ist idempotent und erfasst bei NULL alle Mandanten", async () => {
    await prisma.$transaction((tx) => migrateZoneTexts(tx, null));
    await prisma.$transaction((tx) => migrateZoneTexts(tx, null));
    expect(await prisma.zone.count({ where: { tenantId: T } })).toBe(2);
    expect(await prisma.zone.count({ where: { tenantId: OTHER } })).toBe(1);
    const o = await prisma.storageLocation.findFirstOrThrow({ where: { tenantId: OTHER } });
    expect(o.zoneId).not.toBeNull();
    // Zonen sind je Mandant getrennt, auch bei gleichem Namen
    const tz = await prisma.zone.findFirstOrThrow({ where: { tenantId: T, name: "Kühlraum" } });
    expect(o.zoneId).not.toBe(tz.id);
    // Nie eine Zone über Mandantengrenzen erben — auch nicht bei inkonsistentem defaultLocationId.
    const foreign = await prisma.article.findFirstOrThrow({ where: { tenantId: T, sku: "A-FOREIGN-LOC" } });
    expect(foreign.zoneId).toBeNull();
    expect((await prisma.article.findFirstOrThrow({ where: { tenantId: OTHER } })).zoneId).toBe(o.zoneId);
  });

  it("die Migration enthält exakt dieses SQL", () => {
    const norm = (s: string) =>
      s.replace(/--.*$/gm, "").replace(/\(\$1::text IS NULL OR [a-z.]*"tenantId" = \$1::text\)/g, "TRUE").replace(/\s+/g, " ").trim();
    const mig = fs.readFileSync(path.resolve(__dirname, "../../prisma/migrations/20261017110000_zones/migration.sql"), "utf8");
    expect(norm(mig)).toContain(norm(zoneTextMigrationSql()));
  });
});
