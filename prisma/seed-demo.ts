/**
 * Seed-Skript für den Tenant "demo" — füllt jeden Bereich mit realistischen Daten.
 *
 * Direkte Prisma-Inserts (Hash-Ketten sind erst M6, hash/prevHash default ""; die
 * append-only-Trigger blocken nur UPDATE/DELETE, INSERT ist erlaubt). Idempotent:
 * Upserts auf den Unique-Keys; Bestände/Bestellungen/Vorschläge per Marker übersprungen,
 * wenn schon vorhanden — mehrfaches Ausführen erzeugt keine Duplikate.
 *
 * Lauf gegen eine LOKALE Dev-DB:
 *   DATABASE_URL="postgres://…/local" pnpm tsx prisma/seed-demo.ts
 *
 * Lauf gegen PROD: die Prod-DB hängt am privaten Scaleway-Endpoint (172.16.x) und ist
 * nur von der VM/aus dem Container erreichbar. Daher bündeln und im App-Container fahren:
 *   pnpm exec esbuild prisma/seed-demo.ts --bundle --platform=node --format=cjs \
 *     --external:@prisma/client --outfile=/tmp/seed.cjs
 *   scp /tmp/seed.cjs root@<vm>:/tmp/ && ssh root@<vm> \
 *     'docker cp /tmp/seed.cjs logistics-app-1:/app/seed.cjs && \
 *      docker exec -w /app logistics-app-1 node seed.cjs && \
 *      docker exec -u root logistics-app-1 rm -f /app/seed.cjs'
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- Seed-Skript: pragmatische Coercion von Strings auf Prisma-Enums/Decimal/Json */
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { generateOrdersEdifact } from "../lib/edi/generate-orders";
import {
  DEMO_TENANT_SLUG,
  demoLocations,
  demoSuppliers,
  demoArticles,
  demoOrders,
} from "./demo-data";

const prisma = new PrismaClient();

// neutrale Einheiten → UnitKind-Enum
const UNIT: Record<string, string> = {
  kg: "KG", g: "G", L: "L", ml: "ML", Stk: "PIECE", Pack: "PACK",
  Sack: "SACK", Box: "BOX", Karton: "BOX", Eimer: "PACK",
  Kanister: "PACK", Palette: "PALLET",
};
const unit = (u: string) => (UNIT[u] ?? "OTHER") as any;
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

async function main() {
  // 1) Tenant "demo" finden (case-insensitive)
  const tenant = await prisma.tenant.findFirst({
    where: { name: { equals: DEMO_TENANT_SLUG, mode: "insensitive" } },
  });
  if (!tenant) {
    const all = await prisma.tenant.findMany({ select: { name: true } });
    throw new Error(
      `Tenant "${DEMO_TENANT_SLUG}" nicht gefunden. Vorhanden: ${all.map((t) => t.name).join(", ")}`,
    );
  }
  const tenantId = tenant.id;

  // Akteur (für createdBy/Audit) — ein echter User des Tenants, sonst Platzhalter
  const actor = await prisma.user.findFirst({ where: { tenantId } });
  const actorId = actor?.id ?? "seed";
  const actorEmail = actor?.email ?? "seed@demo.local";
  console.log(`Tenant: ${tenant.name} (${tenantId}) · Akteur: ${actorEmail}`);

  // 2) Lagerplätze
  const locId: Record<string, string> = {};
  for (const l of demoLocations) {
    const row = await prisma.storageLocation.upsert({
      where: { tenantId_code: { tenantId, code: l.code } },
      update: { name: l.name, zone: l.zone },
      create: { tenantId, code: l.code, name: l.name, zone: l.zone },
    });
    locId[l.code] = row.id;
  }
  console.log(`Lagerplätze: ${Object.keys(locId).length}`);

  // 3) Lieferanten
  const supId: Record<string, string> = {};
  for (const s of demoSuppliers) {
    const cfg =
      s.channel === "EMAIL"
        ? { email: s.email }
        : s.channel === "API"
          ? { url: "https://example.invalid/orders", note: "Demo — kein echter Endpoint" }
          : { partnerId: s.key.toUpperCase(), note: "Demo-EDI" };
    const row = await prisma.supplier.upsert({
      where: { tenantId_name: { tenantId, name: s.name } },
      update: {
        contactName: s.contact, email: s.email, phone: s.phone, city: s.city,
        channel: s.channel as any, channelConfig: cfg as any,
      },
      create: {
        tenantId, name: s.name, contactName: s.contact, email: s.email,
        phone: s.phone, city: s.city, country: "DE",
        channel: s.channel as any, channelConfig: cfg as any,
      },
    });
    supId[s.key] = row.id;
  }
  console.log(`Lieferanten: ${Object.keys(supId).length}`);

  // 4) Artikel + Lieferanten-Verknüpfung (Preis/primär) + Anfangsbestand
  const art: Record<string, { id: string; packFactor: number; ek: number; locId: string; supKey: string }> = {};
  for (const a of demoArticles) {
    const lId = locId[a.location];
    const row = await prisma.article.upsert({
      where: { tenantId_sku: { tenantId, sku: a.sku } },
      update: {
        name: a.name, eanGtin: a.ean, baseUnit: unit(a.baseUnit), orderUnit: unit(a.orderUnit),
        packFactor: a.packFactor, minStock: a.minStock, defaultLocationId: lId,
      },
      create: {
        tenantId, sku: a.sku, name: a.name, eanGtin: a.ean, category: null,
        baseUnit: unit(a.baseUnit), orderUnit: unit(a.orderUnit),
        packFactor: a.packFactor, minStock: a.minStock, defaultLocationId: lId,
      },
    });
    art[a.sku] = { id: row.id, packFactor: a.packFactor, ek: a.ek, locId: lId, supKey: a.supplier };

    await prisma.articleSupplier.upsert({
      where: { articleId_supplierId: { articleId: row.id, supplierId: supId[a.supplier] } },
      update: { purchasePrice: a.ek as any, isPrimary: true },
      create: {
        articleId: row.id, supplierId: supId[a.supplier], purchasePrice: a.ek as any,
        currency: "EUR", isPrimary: true, leadTimeDays: 3, minOrderQty: 1,
      },
    });

    // Anfangsbestand nur setzen, wenn noch keine Balance existiert (idempotent)
    const bal = await prisma.stockBalance.findUnique({
      where: { articleId_locationId: { articleId: row.id, locationId: lId } },
    });
    if (!bal) {
      await prisma.stockBalance.create({
        data: { tenantId, articleId: row.id, locationId: lId, quantity: a.initialStock },
      });
      if (a.initialStock !== 0) {
        await prisma.stockMovement.create({
          data: {
            tenantId, articleId: row.id, locationId: lId, delta: a.initialStock,
            reason: "INITIAL_SEED", note: "Demo-Anfangsbestand", createdBy: actorId,
          },
        });
      }
    }
  }
  console.log(`Artikel: ${Object.keys(art).length}`);

  // 5) Bestellungen + Positionen (Marker notes="DEMO_SEED", idempotent)
  const haveOrders = await prisma.order.count({ where: { tenantId, notes: "DEMO_SEED" } });
  if (haveOrders === 0) {
    let seq = 1;
    for (const o of demoOrders) {
      const created = daysAgo(o.createdDaysAgo);
      const items = o.items.map((it) => {
        const a = art[it.sku];
        const unitPrice = a.ek;
        const lineTotal = +(unitPrice * it.qty).toFixed(2);
        return {
          articleId: a.id, qtyOrderUnit: it.qty, qtyBase: it.qty * a.packFactor,
          unitPrice: unitPrice as any, lineTotal: lineTotal as any,
          qtyReceived:
            o.status === "RECEIVED" ? it.qty
            : o.status === "PARTIALLY_RECEIVED" ? Math.max(1, Math.floor(it.qty / 2))
            : 0,
          createdAt: created,
        };
      });
      const total = +items.reduce((s, i) => s + Number(i.lineTotal), 0).toFixed(2);
      const orderNo = `DEMO-2026-${String(seq).padStart(4, "0")}`;
      seq++;

      const confirmed = ["CONFIRMED", "PARTIALLY_RECEIVED", "RECEIVED"].includes(o.status);
      await prisma.order.create({
        data: {
          tenantId, orderNo, supplierId: supId[o.supplier], status: o.status as any,
          currency: "EUR", total: total as any, notes: "DEMO_SEED", createdBy: actorId,
          createdAt: created,
          sentAt: o.sentDaysAgo != null ? daysAgo(o.sentDaysAgo) : null,
          confirmedAt: confirmed ? daysAgo(Math.max(0, o.createdDaysAgo - 1)) : null,
          cancelledAt: o.status === "CANCELLED" ? daysAgo(Math.max(0, o.createdDaysAgo - 1)) : null,
          items: { create: items },
          events: {
            create: [{
              type: "CREATED", toStatus: o.status as any, actorId, actorEmail,
              payload: { seed: true } as any, createdAt: created,
            }],
          },
        },
      });

      // Audit-Eintrag je Bestellung (damit der Audit-Bereich gefüllt ist)
      await prisma.auditLog.create({
        data: {
          tenantId, entity: "Order", entityId: orderNo, action: "CREATE",
          actorId, actorEmail, after: { orderNo, total, status: o.status } as any,
          createdAt: created,
        },
      });
    }
    console.log(`Bestellungen: ${demoOrders.length} (+ Events + Audit)`);
  } else {
    console.log(`Bestellungen: übersprungen (${haveOrders} DEMO_SEED bereits vorhanden)`);
  }

  // 6) Bestellvorschläge für unterdeckte Artikel (Marker note="DEMO_SEED")
  const haveSugg = await prisma.orderSuggestion.count({ where: { tenantId, note: "DEMO_SEED" } });
  if (haveSugg === 0) {
    let n = 0;
    for (const a of demoArticles) {
      if (a.initialStock >= a.minStock) continue;
      const need = a.minStock - a.initialStock;
      const qtyOrderUnit = Math.max(1, Math.ceil(need / a.packFactor));
      await prisma.orderSuggestion.create({
        data: {
          tenantId, articleId: art[a.sku].id, supplierId: supId[a.supplier],
          qtyOrderUnit, reason: "AUTO_MIN_STOCK", status: "PENDING",
          note: "DEMO_SEED", createdBy: actorId,
        },
      });
      n++;
    }
    console.log(`Bestellvorschläge: ${n}`);
  } else {
    console.log(`Bestellvorschläge: übersprungen (${haveSugg} bereits vorhanden)`);
  }

  // 7) Eine Begrüßungs-Notification (Header-Glocke)
  const haveNotif = await prisma.notification.count({ where: { tenantId, type: "DEMO_SEED" } });
  if (haveNotif === 0) {
    await prisma.notification.create({
      data: {
        tenantId, type: "DEMO_SEED", title: "Demodaten geladen",
        body: "Lieferanten, Artikel, Bestände, Bestellungen und Vorschläge wurden angelegt.",
        link: "/dashboard",
      },
    });
  }

  // 8) EDI: Versandprofil (Identität), Postfach + Beispiel-Nachrichten
  const DEMO_GLN = "4098765000004";
  const PARTNER_GLN = "4033300000006"; // ZuckerWelt (EDI-Lieferant)

  const haveEdiProfile = await prisma.tenantChannelConfig.count({ where: { tenantId, channel: "EDI" } });
  if (haveEdiProfile === 0) {
    await prisma.tenantChannelConfig.create({
      data: {
        tenantId, channel: "EDI", active: true, isDefault: true, label: "EDIFACT Standard",
        config: { senderId: DEMO_GLN, senderQualifier: "14", edifactVersion: "D.96A" },
      },
    });
    console.log("EDI-Versandprofil angelegt");
  }

  await prisma.tenantEdiSettings.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId, inboundToken: `edi_${crypto.randomBytes(20).toString("hex")}` },
  });

  // ZuckerWelt bekommt eine echte Partner-GLN (EDI-Ausgang funktionsfähig, Datei-Transport)
  await prisma.supplier.updateMany({
    where: { tenantId, name: "ZuckerWelt Handels GmbH" },
    data: { channelConfig: { partnerId: PARTNER_GLN, partnerQualifier: "14" } },
  });

  const haveEdiMsgs = await prisma.ediMessage.count({ where: { tenantId, createdBy: "demo-seed" } });
  if (haveEdiMsgs === 0) {
    const zw = await prisma.supplier.findFirst({ where: { tenantId, name: "ZuckerWelt Handels GmbH" } });
    const order4 = await prisma.order.findFirst({
      where: { tenantId, orderNo: "DEMO-2026-0004" },
      include: { items: { include: { article: true } } },
    });
    let n = 0;

    if (zw && order4) {
      // OUT: die real versendete ORDERS zur EDI-Bestellung (echtes EDIFACT)
      const gen = generateOrdersEdifact({
        orderNo: order4.orderNo,
        currency: order4.currency,
        orderDate: order4.createdAt,
        sender: { id: DEMO_GLN, qualifier: "14" },
        recipient: { id: PARTNER_GLN, qualifier: "14" },
        items: order4.items.map((it) => ({
          sku: it.article.sku, name: it.article.name, ean: it.article.eanGtin,
          qtyOrderUnit: it.qtyOrderUnit, orderUnit: it.article.orderUnit, unitPrice: Number(it.unitPrice),
        })),
      });
      await prisma.ediMessage.create({
        data: {
          tenantId, direction: "OUT", type: "ORDERS", status: "SENT", transport: "http",
          supplierId: zw.id, orderId: order4.id, interchangeRef: gen.interchangeRef,
          documentNo: order4.orderNo, payload: gen.payload, createdBy: "demo-seed",
          createdAt: order4.createdAt,
        },
      });
      n++;

      // IN: die ORDRSP-Bestätigung des Lieferanten dazu
      const ordrsp =
        "UNA:+.? '\n" +
        `UNB+UNOC:3+${PARTNER_GLN}:14+${DEMO_GLN}:14+260625:1112+ICZW881'\n` +
        "UNH+MEZW881+ORDRSP:D:96A:UN'\n" +
        "BGM+231+AB-77123+29'\n" +
        `RFF+ON:${order4.orderNo}'\n` +
        "UNT+4+MEZW881'\n" +
        "UNZ+1+ICZW881'";
      await prisma.ediMessage.create({
        data: {
          tenantId, direction: "IN", type: "ORDRSP", status: "PROCESSED", transport: "inbound",
          supplierId: zw.id, orderId: order4.id, interchangeRef: "ICZW881",
          documentNo: "AB-77123", payload: ordrsp, createdBy: "demo-seed",
          parsed: { type: "ORDRSP", documentNo: "AB-77123", orderReference: order4.orderNo, responseCode: "29", senderId: PARTNER_GLN },
          createdAt: daysAgo(6),
        },
      });
      n++;
    }

    // IN: eine eingehende Kundenbestellung (ORDERS) mit Artikel-Match per EAN
    const mehl = await prisma.article.findFirst({ where: { tenantId, sku: "MEHL-W550-25" } });
    const zucker = await prisma.article.findFirst({ where: { tenantId, sku: "ZUCK-W-25" } });
    if (mehl && zucker) {
      const KUNDE_GLN = "4111111000005";
      const genIn = generateOrdersEdifact({
        orderNo: "KD-2026-0458",
        currency: "EUR",
        orderDate: daysAgo(1),
        sender: { id: KUNDE_GLN, qualifier: "14" },
        recipient: { id: DEMO_GLN, qualifier: "14" },
        items: [
          { sku: mehl.sku, name: mehl.name, ean: mehl.eanGtin, qtyOrderUnit: 6, orderUnit: mehl.orderUnit, unitPrice: 19.5 },
          { sku: zucker.sku, name: zucker.name, ean: zucker.eanGtin, qtyOrderUnit: 4, orderUnit: zucker.orderUnit, unitPrice: 24.0 },
        ],
      });
      await prisma.ediMessage.create({
        data: {
          tenantId, direction: "IN", type: "ORDERS", status: "PROCESSED", transport: "inbound",
          interchangeRef: genIn.interchangeRef, documentNo: "KD-2026-0458",
          payload: genIn.payload, createdBy: "demo-seed",
          parsed: {
            type: "ORDERS", documentNo: "KD-2026-0458", buyerId: KUNDE_GLN, supplierId: DEMO_GLN,
            currency: "EUR", orderDate: "20260630", matchedLines: 2,
            lines: [
              { lineNo: 1, ean: mehl.eanGtin, sku: mehl.sku, name: mehl.name, qty: 6, unit: "SA", price: 19.5, articleId: mehl.id, articleName: mehl.name },
              { lineNo: 2, ean: zucker.eanGtin, sku: zucker.sku, name: zucker.name, qty: 4, unit: "SA", price: 24.0, articleId: zucker.id, articleName: zucker.name },
            ],
          },
          createdAt: daysAgo(1),
        },
      });
      n++;
    }

    // IN: eine nicht unterstützte INVOIC → FAILED (zeigt Fehlerpfad im Monitor)
    const invoic =
      "UNA:+.? '\n" +
      `UNB+UNOC:3+${PARTNER_GLN}:14+${DEMO_GLN}:14+260701:0705+ICZW905'\n` +
      "UNH+MEZW905+INVOIC:D:96A:UN'\n" +
      "BGM+380+RE-2026-4411'\n" +
      "UNT+3+MEZW905'\n" +
      "UNZ+1+ICZW905'";
    await prisma.ediMessage.create({
      data: {
        tenantId, direction: "IN", type: "INVOIC", status: "FAILED", transport: "inbound",
        interchangeRef: "ICZW905", documentNo: "RE-2026-4411", payload: invoic, createdBy: "demo-seed",
        error: "Nachrichtentyp INVOIC wird nicht unterstützt (nur ORDERS/ORDRSP)",
        createdAt: daysAgo(0),
      },
    });
    n++;
    console.log(`EDI-Nachrichten: ${n}`);
  } else {
    console.log(`EDI-Nachrichten: übersprungen (${haveEdiMsgs} bereits vorhanden)`);
  }

  console.log("✓ Demo-Seed abgeschlossen.");
}

main()
  .catch((e) => { console.error("SEED-FEHLER:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
