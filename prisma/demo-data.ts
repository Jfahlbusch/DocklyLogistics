/**
 * Demo-Datensatz für den Tenant "demo" — Bäckerei-/Lebensmittel-Großhandel-Logistik.
 *
 * Reiner Content in neutraler Form. Das Seed-Skript (prisma/seed-demo.ts) mappt diese
 * Daten gegen die echten Repos/Services:
 *   - Bestände NICHT roh in StockMovement/StockBalance inserten — über die Stock-Service/
 *     adjust-Funktion gehen (Hash-Kette + append-only-Trigger laut CLAUDE.md).
 *   - Lieferant/Artikel/Lagerplatz über die jeweiligen Repos create-Funktionen.
 *   - Bestellungen über das Order-Repo/Service; Status nachträglich setzen, wo nötig.
 *   - Bestellvorschläge: entweder über den Suggest-Service generieren (zieht below-min
 *     automatisch) oder als PENDING-Vorschläge zu den unterdeckten Artikeln anlegen.
 *
 * Mengen sind so gewählt, dass jeder Bereich gut gefüllt ist und einige Artikel unter
 * Mindestbestand liegen (→ erzeugt Bestellvorschläge). Erstellt 2026-06-24.
 */

export const DEMO_TENANT_SLUG = "demo";

/** Lagerplätze über mehrere Temperaturzonen. */
export const demoLocations = [
  { code: "WA-01", name: "Wareneingang / Kommissionierung", zone: "Wareneingang" },
  { code: "TR-A1", name: "Trockenlager Regal A1", zone: "Trocken" },
  { code: "TR-A2", name: "Trockenlager Regal A2", zone: "Trocken" },
  { code: "TR-B1", name: "Trockenlager Regal B1", zone: "Trocken" },
  { code: "TR-B2", name: "Trockenlager Regal B2 (Verpackung)", zone: "Trocken" },
  { code: "KU-K1", name: "Kühlhaus 1 (+4 °C)", zone: "Kühl" },
  { code: "KU-K2", name: "Kühlhaus 2 (+4 °C)", zone: "Kühl" },
  { code: "TK-01", name: "Tiefkühlzelle (−18 °C)", zone: "Tiefkühl" },
];

/** Lieferanten über alle drei Versandkanäle (EMAIL/API/EDI). */
export const demoSuppliers = [
  { key: "weizenkamp", name: "Großmühle Weizenkamp GmbH", contact: "Annette Kamp", email: "bestellung@weizenkamp.de", phone: "+49 40 1234500", city: "Hamburg", channel: "EMAIL", note: "Mehl & Getreide, Lieferung Di/Do" },
  { key: "suedmilch",  name: "Molkerei SüdMilch eG",      contact: "Josef Brandl",  email: "orders@suedmilch.de",      phone: "+49 711 998800", city: "Stuttgart", channel: "API",   note: "Milch, Butter, Sahne — Kühlkette" },
  { key: "eierhof",    name: "Eierhof Bauer KG",          contact: "Maria Bauer",   email: "info@eierhof-bauer.de",    phone: "+49 251 445566", city: "Münster",   channel: "EMAIL", note: "Freilandeier, regional" },
  { key: "backmittel", name: "Backmittel Profi AG",       contact: "Dr. Theo Renz", email: "vertrieb@backmittel-profi.de", phone: "+49 221 778899", city: "Köln",  channel: "EMAIL", note: "Hefe, Backmittel, Triebmittel" },
  { key: "zuckerwelt", name: "ZuckerWelt Handels GmbH",   contact: "Petra Süß",     email: "edi@zuckerwelt.de",        phone: "+49 69 223344",  city: "Frankfurt", channel: "EDI",   note: "Zucker & Süßungsmittel, EDI/EDIFACT" },
  { key: "nusskern",   name: "NussKern Import",           contact: "Ali Yıldız",    email: "order@nusskern.de",        phone: "+49 421 556677", city: "Bremen",    channel: "EMAIL", note: "Nüsse, Saaten, Trockenfrüchte" },
  { key: "verpackung", name: "Verpackungsplus GmbH",      contact: "Sandra Lohse",  email: "b2b@verpackungsplus.de",   phone: "+49 211 334455", city: "Düsseldorf",channel: "API",   note: "Tüten, Kartons, Folien" },
  { key: "schokotraum",name: "SchokoTraum Confiserie",    contact: "Lukas Berg",    email: "grosshandel@schokotraum.de",phone: "+49 241 667788", city: "Aachen",    channel: "EMAIL", note: "Kuvertüre & Schokolade" },
];

/**
 * Artikel. initialStock < minStock ⇒ Unterdeckung ⇒ Bestellvorschlag.
 * baseUnit = Lagereinheit, orderUnit = Bestelleinheit, packFactor = baseUnits je orderUnit.
 */
export const demoArticles = [
  // --- Mehl & Getreide (weizenkamp, Trocken) ---
  { sku: "MEHL-W550-25", name: "Weizenmehl Type 550",        ean: "4011200550251", baseUnit: "kg", orderUnit: "Sack",   packFactor: 25, ek: 16.90, minStock: 250, location: "TR-A1", supplier: "weizenkamp", initialStock: 180 },
  { sku: "MEHL-W405-25", name: "Weizenmehl Type 405",        ean: "4011200405252", baseUnit: "kg", orderUnit: "Sack",   packFactor: 25, ek: 17.40, minStock: 150, location: "TR-A1", supplier: "weizenkamp", initialStock: 200 },
  { sku: "MEHL-R1150-25",name: "Roggenmehl Type 1150",       ean: "4011200115025", baseUnit: "kg", orderUnit: "Sack",   packFactor: 25, ek: 18.20, minStock: 100, location: "TR-A1", supplier: "weizenkamp", initialStock: 75 },
  { sku: "MEHL-D630-25", name: "Dinkelmehl Type 630",        ean: "4011200630253", baseUnit: "kg", orderUnit: "Sack",   packFactor: 25, ek: 24.50, minStock: 75,  location: "TR-A2", supplier: "weizenkamp", initialStock: 90 },
  { sku: "MEHL-WVK-25",  name: "Weizenvollkornmehl",         ean: "4011200999253", baseUnit: "kg", orderUnit: "Sack",   packFactor: 25, ek: 19.80, minStock: 50,  location: "TR-A2", supplier: "weizenkamp", initialStock: 30 },

  // --- Triebmittel & Backmittel (backmittel) ---
  { sku: "HEFE-FR-1",    name: "Frischhefe Block 1 kg",      ean: "4022100000011", baseUnit: "Stk",orderUnit: "Karton", packFactor: 10, ek: 12.50, minStock: 40,  location: "KU-K1", supplier: "backmittel", initialStock: 22 },
  { sku: "HEFE-TR-05",   name: "Trockenhefe 500 g",          ean: "4022100000028", baseUnit: "Stk",orderUnit: "Karton", packFactor: 20, ek: 38.00, minStock: 20,  location: "TR-B1", supplier: "backmittel", initialStock: 60 },
  { sku: "BACK-MALZ-5",  name: "Backmalz aktiv 5 kg",        ean: "4022100000059", baseUnit: "Eimer",orderUnit:"Eimer",  packFactor: 1,  ek: 21.00, minStock: 8,   location: "TR-B1", supplier: "backmittel", initialStock: 5 },
  { sku: "SAUER-ST-10",  name: "Sauerteig-Starter 10 kg",    ean: "4022100000103", baseUnit: "Eimer",orderUnit:"Eimer",  packFactor: 1,  ek: 28.50, minStock: 6,   location: "KU-K1", supplier: "backmittel", initialStock: 9 },
  { sku: "BACKPULVER-5", name: "Backpulver 5 kg",            ean: "4022100000509", baseUnit: "Sack",orderUnit: "Sack",  packFactor: 1,  ek: 14.20, minStock: 10,  location: "TR-B1", supplier: "backmittel", initialStock: 14 },

  // --- Süßung (zuckerwelt) ---
  { sku: "ZUCK-W-25",    name: "Zucker weiß 25 kg",          ean: "4033300250010", baseUnit: "kg", orderUnit: "Sack",   packFactor: 25, ek: 22.00, minStock: 200, location: "TR-A2", supplier: "zuckerwelt", initialStock: 150 },
  { sku: "ZUCK-PUD-10",  name: "Puderzucker 10 kg",          ean: "4033300100107", baseUnit: "kg", orderUnit: "Sack",   packFactor: 10, ek: 11.50, minStock: 50,  location: "TR-A2", supplier: "zuckerwelt", initialStock: 65 },
  { sku: "ZUCK-BR-10",   name: "Brauner Zucker 10 kg",       ean: "4033300100206", baseUnit: "kg", orderUnit: "Sack",   packFactor: 10, ek: 13.80, minStock: 30,  location: "TR-A2", supplier: "zuckerwelt", initialStock: 18 },
  { sku: "HONIG-EI-25",  name: "Blütenhonig Eimer 25 kg",    ean: "4033300250256", baseUnit: "Eimer",orderUnit:"Eimer",  packFactor: 1,  ek: 119.00,minStock: 4,   location: "TR-A2", supplier: "zuckerwelt", initialStock: 6 },

  // --- Milch / Fette (suedmilch, Kühl) ---
  { sku: "BUTTER-10",    name: "Butterblock 10 kg",          ean: "4044400100103", baseUnit: "kg", orderUnit: "Karton", packFactor: 10, ek: 68.00, minStock: 80,  location: "KU-K1", supplier: "suedmilch", initialStock: 50 },
  { sku: "MILCH-VL-10",  name: "Vollmilch 3,5 % 10 L",       ean: "4044400100509", baseUnit: "L",  orderUnit: "Box",    packFactor: 10, ek: 9.90,  minStock: 60,  location: "KU-K2", supplier: "suedmilch", initialStock: 40 },
  { sku: "SAHNE-30-5",   name: "Schlagsahne 30 % 5 L",       ean: "4044400050304", baseUnit: "L",  orderUnit: "Box",    packFactor: 5,  ek: 12.40, minStock: 40,  location: "KU-K2", supplier: "suedmilch", initialStock: 55 },
  { sku: "MARG-BACK-10", name: "Backmargarine 10 kg",        ean: "4044400100905", baseUnit: "kg", orderUnit: "Karton", packFactor: 10, ek: 28.00, minStock: 50,  location: "KU-K1", supplier: "suedmilch", initialStock: 70 },

  // --- Eier (eierhof) ---
  { sku: "EIER-M-360",   name: "Eier Größe M (Karton 360)",  ean: "4055500360010", baseUnit: "Stk",orderUnit: "Karton", packFactor: 360,ek: 54.00, minStock: 720, location: "KU-K2", supplier: "eierhof", initialStock: 540 },
  { sku: "EI-FLUESS-10", name: "Flüssigei pasteurisiert 10 kg",ean:"4055500100106",baseUnit: "kg", orderUnit: "Kanister",packFactor:10, ek: 32.00, minStock: 30,  location: "KU-K2", supplier: "eierhof", initialStock: 20 },

  // --- Nüsse / Saaten (nusskern, Trocken) ---
  { sku: "NUSS-WAL-5",   name: "Walnusskerne 5 kg",          ean: "4066600050017", baseUnit: "kg", orderUnit: "Karton", packFactor: 5,  ek: 79.00, minStock: 20,  location: "TR-B1", supplier: "nusskern", initialStock: 12 },
  { sku: "NUSS-MAN-5",   name: "Mandeln gehobelt 5 kg",      ean: "4066600050024", baseUnit: "kg", orderUnit: "Karton", packFactor: 5,  ek: 62.00, minStock: 25,  location: "TR-B1", supplier: "nusskern", initialStock: 30 },
  { sku: "SAAT-SONN-10", name: "Sonnenblumenkerne 10 kg",    ean: "4066600100108", baseUnit: "kg", orderUnit: "Sack",   packFactor: 10, ek: 24.00, minStock: 40,  location: "TR-B1", supplier: "nusskern", initialStock: 22 },
  { sku: "SAAT-SES-5",   name: "Sesam ungeschält 5 kg",      ean: "4066600050055", baseUnit: "kg", orderUnit: "Karton", packFactor: 5,  ek: 27.50, minStock: 20,  location: "TR-B1", supplier: "nusskern", initialStock: 35 },
  { sku: "FRU-ROS-10",   name: "Rosinen 10 kg",              ean: "4066600100207", baseUnit: "kg", orderUnit: "Karton", packFactor: 10, ek: 33.00, minStock: 30,  location: "TR-B2", supplier: "nusskern", initialStock: 16 },

  // --- Schokolade (schokotraum) ---
  { sku: "KUV-ZB-10",    name: "Zartbitter-Kuvertüre 10 kg", ean: "4077700100100", baseUnit: "kg", orderUnit: "Karton", packFactor: 10, ek: 95.00, minStock: 30,  location: "TR-A2", supplier: "schokotraum", initialStock: 24 },
  { sku: "KUV-VM-10",    name: "Vollmilch-Kuvertüre 10 kg",  ean: "4077700100209", baseUnit: "kg", orderUnit: "Karton", packFactor: 10, ek: 92.00, minStock: 30,  location: "TR-A2", supplier: "schokotraum", initialStock: 40 },
  { sku: "SCHOKO-TR-5",  name: "Schokotropfen 5 kg",         ean: "4077700050056", baseUnit: "kg", orderUnit: "Karton", packFactor: 5,  ek: 41.00, minStock: 20,  location: "TR-A2", supplier: "schokotraum", initialStock: 28 },

  // --- Verpackung (verpackung, Trocken) ---
  { sku: "VP-BTUE-1000", name: "Bäckertüten Papier (1000 Stk)",ean:"4088800100001",baseUnit:"Pack",orderUnit:"Karton", packFactor: 10, ek: 36.00, minStock: 15,  location: "TR-B2", supplier: "verpackung", initialStock: 9 },
  { sku: "VP-BRTUE-2000",name: "Brötchentüten (2000 Stk)",   ean: "4088800200008", baseUnit:"Pack",orderUnit:"Karton",  packFactor: 5,  ek: 44.00, minStock: 12,  location: "TR-B2", supplier: "verpackung", initialStock: 20 },
  { sku: "VP-TORTE-28",  name: "Tortenkartons 28 cm (50 Stk)",ean:"4088800280005",baseUnit: "Pack",orderUnit:"Karton",  packFactor: 4,  ek: 29.00, minStock: 10,  location: "TR-B2", supplier: "verpackung", initialStock: 14 },

  // --- Sonstiges Trocken ---
  { sku: "SALZ-25",      name: "Speisesalz 25 kg",           ean: "4099900250015", baseUnit: "kg", orderUnit: "Sack",   packFactor: 25, ek: 8.90,  minStock: 75,  location: "TR-A1", supplier: "zuckerwelt", initialStock: 100 },
];

/**
 * Bestellungen über alle Status. items[].sku referenziert demoArticles, qty in orderUnit.
 * createdDaysAgo / sentDaysAgo relativ zum Seed-Zeitpunkt.
 */
export const demoOrders = [
  { supplier: "weizenkamp", channel: "EMAIL", status: "RECEIVED",            createdDaysAgo: 21, sentDaysAgo: 21, items: [{ sku: "MEHL-W550-25", qty: 8 }, { sku: "MEHL-W405-25", qty: 4 }, { sku: "MEHL-R1150-25", qty: 4 }] },
  { supplier: "suedmilch",  channel: "API",   status: "RECEIVED",            createdDaysAgo: 14, sentDaysAgo: 14, items: [{ sku: "BUTTER-10", qty: 6 }, { sku: "MILCH-VL-10", qty: 8 }, { sku: "SAHNE-30-5", qty: 6 }] },
  { supplier: "eierhof",    channel: "EMAIL", status: "RECEIVED",            createdDaysAgo: 10, sentDaysAgo: 10, items: [{ sku: "EIER-M-360", qty: 3 }] },
  { supplier: "zuckerwelt", channel: "EDI",   status: "PARTIALLY_RECEIVED",  createdDaysAgo: 7,  sentDaysAgo: 7,  items: [{ sku: "ZUCK-W-25", qty: 10 }, { sku: "ZUCK-PUD-10", qty: 4 }, { sku: "HONIG-EI-25", qty: 2 }] },
  { supplier: "backmittel", channel: "EMAIL", status: "CONFIRMED",           createdDaysAgo: 4,  sentDaysAgo: 4,  items: [{ sku: "HEFE-FR-1", qty: 6 }, { sku: "BACK-MALZ-5", qty: 4 }] },
  { supplier: "schokotraum",channel: "EMAIL", status: "CONFIRMED",           createdDaysAgo: 3,  sentDaysAgo: 3,  items: [{ sku: "KUV-ZB-10", qty: 3 }, { sku: "KUV-VM-10", qty: 2 }] },
  { supplier: "nusskern",   channel: "EMAIL", status: "SENT",                createdDaysAgo: 2,  sentDaysAgo: 2,  items: [{ sku: "NUSS-WAL-5", qty: 4 }, { sku: "FRU-ROS-10", qty: 3 }] },
  { supplier: "verpackung", channel: "API",   status: "SENT",                createdDaysAgo: 1,  sentDaysAgo: 1,  items: [{ sku: "VP-BTUE-1000", qty: 4 }] },
  { supplier: "weizenkamp", channel: "EMAIL", status: "DRAFT",               createdDaysAgo: 0,  sentDaysAgo: null, items: [{ sku: "MEHL-WVK-25", qty: 4 }, { sku: "MEHL-D630-25", qty: 2 }] },
  { supplier: "suedmilch",  channel: "API",   status: "DRAFT",               createdDaysAgo: 0,  sentDaysAgo: null, items: [{ sku: "BUTTER-10", qty: 6 }] },
  { supplier: "zuckerwelt", channel: "EDI",   status: "CANCELLED",           createdDaysAgo: 12, sentDaysAgo: null, items: [{ sku: "ZUCK-BR-10", qty: 6 }] },
];

/**
 * Bestellvorschläge — werden bevorzugt über den Suggest-Service aus den unterdeckten
 * Artikeln generiert (initialStock < minStock). Diese Liste dient als Fallback/Erwartung.
 * reason: BELOW_MIN. qtyOrderUnit so gewählt, dass wieder über Mindestbestand.
 */
export const demoSuggestionsExpected = [
  { sku: "MEHL-W550-25",  supplier: "weizenkamp", reason: "BELOW_MIN" },
  { sku: "MEHL-R1150-25", supplier: "weizenkamp", reason: "BELOW_MIN" },
  { sku: "MEHL-WVK-25",   supplier: "weizenkamp", reason: "BELOW_MIN" },
  { sku: "HEFE-FR-1",     supplier: "backmittel", reason: "BELOW_MIN" },
  { sku: "BACK-MALZ-5",   supplier: "backmittel", reason: "BELOW_MIN" },
  { sku: "ZUCK-W-25",     supplier: "zuckerwelt", reason: "BELOW_MIN" },
  { sku: "ZUCK-BR-10",    supplier: "zuckerwelt", reason: "BELOW_MIN" },
  { sku: "BUTTER-10",     supplier: "suedmilch",  reason: "BELOW_MIN" },
  { sku: "MILCH-VL-10",   supplier: "suedmilch",  reason: "BELOW_MIN" },
  { sku: "EIER-M-360",    supplier: "eierhof",    reason: "BELOW_MIN" },
  { sku: "EI-FLUESS-10",  supplier: "eierhof",    reason: "BELOW_MIN" },
  { sku: "NUSS-WAL-5",    supplier: "nusskern",   reason: "BELOW_MIN" },
  { sku: "SAAT-SONN-10",  supplier: "nusskern",   reason: "BELOW_MIN" },
  { sku: "FRU-ROS-10",    supplier: "nusskern",   reason: "BELOW_MIN" },
  { sku: "KUV-ZB-10",     supplier: "schokotraum",reason: "BELOW_MIN" },
  { sku: "VP-BTUE-1000",  supplier: "verpackung", reason: "BELOW_MIN" },
];
