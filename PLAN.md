# Plan: DocklyLogistics — Härtung & Testabdeckung — 2026-07-31

## Ziel

DocklyLogistics läuft produktiv (logistics.dockly.de) mit echtem EDI-Verkehr zu HIT/Dohle. Die
Geschäftslogik ist gut getestet, aber die **HTTP-Schicht ist praktisch ungeprüft**: 6 von 115
Route-Handlern haben einen Test (5 %). Genau dort sitzen Auth, Tenant-Isolation und die
Zustandsübergänge, deren Fehlverhalten teuer wäre — eine doppelt versendete Bestellung, ein
tenant-übergreifender Datenzugriff. Dieser Plan schließt die Lücke testgetrieben und behebt
die Funktionslücken, die der Live-Betrieb mit Dohle heute sichtbar gemacht hat.

## Anforderungen

| #  | Anforderung | Quelle | Status |
|----|-------------|--------|--------|
| A1 | Alle Funktionen testgetrieben absichern (Test zuerst, rot → grün) | Nutzer | offen |
| A2 | Sauberer Aufbau: keine Duplikate, keine Sammelkomponenten | Nutzer | offen |
| A3 | Lokale Testsuite muss zuverlässig laufen (Voraussetzung für A1) | Befund | offen |
| A4 | Von außen erreichbare Endpunkte beweisbar abgesichert | Befund | offen |
| A5 | EDI-Ausgang muss die im HIT-Guide geforderte Empfänger-GLN nutzen | Prod-Betrieb | offen |
| A6 | Eingehende Bestellpositionen müssen Artikeln zugeordnet werden | Prod-Betrieb | offen |

## Annahmen

- **An1:** Der native Postgres auf Port 5432 (seit 13.07. aktiv) gehört zu einem anderen Projekt
  und darf nicht angetastet werden. *Falls falsch:* Statt den Container umzuziehen, könnte der
  native Postgres die Testdatenbank stellen — dann entfällt A0.1.
- **An2:** Der Live-Betrieb mit Dohle bleibt der Maßstab für die EDI-Arbeiten; weitere Partner
  kommen später dazu. *Falls falsch:* Das Ausgangs-Routing (A5) braucht ein allgemeineres
  Modell statt eines zusätzlichen Feldes.
- **An3:** Bestehende API-Verträge bleiben unverändert — Tests schreiben das Ist-Verhalten fest.
  *Falls falsch:* Abweichungen werden vorher einzeln freigegeben.

## Nicht-Ziele

- Kein Umbau der Schichtung (Route → Service/Repo → Prisma ist gesund und bleibt).
- Keine 100-%-Abdeckung um der Zahl willen — reine Leserouten der Stufe 3 werden stichprobenhaft
  über die Tenant-Isolation abgedeckt, nicht einzeln.
- Keine Feature-Erweiterungen (DESADV, Retouren, neue Screens) — die stehen unter „Später".
- Keine Dependency-Upgrades im selben Zug.

## Architektur

Unverändert der Bestandsstack: Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 ·
Prisma/PostgreSQL · NextAuth v5 + Keycloak · Vitest. Die in `ARCHITECTURE.md` festgehaltene
Schichtung wird konsequent eingehalten und ist die Soll-Struktur — die Schulden liegen nicht in
der Struktur, sondern in fehlenden Tests der HTTP-Schicht.

**Abweichung vom Skill-Default:** Das Fundament (Keycloak, Design-Tokens, PWA, ⌘K-Suche) ist
bereits vollständig vorhanden und wird nicht neu aufgesetzt — Modus B. Playwright ist im Projekt
nicht eingerichtet; UI-Flows werden weiterhin manuell im Mobile-Viewport geprüft, ein
Playwright-Setup steht unter „Später" (eigener Aufwand, kein Blocker für A1).

**Testmuster (bereits etabliert, wird ausgebaut):** Integrationstests importieren den
Route-Handler direkt, mocken `@/lib/auth` und setzen die Header, die die Middleware sonst
setzt (`sessionHeaders(role, tenant)` aus `tests/integration/helpers.ts`). Echte Postgres-DB,
eigener Tenant je Testdatei, tenant-gescopter Cleanup.

## Datenmodell

Bestehend, mandantenfähig (jede Query filtert `tenantId`). Eine Ergänzung ist geplant:

- **A5:** `EdiPartnerMailbox` bekommt ein optionales Feld für die **Ausgangs-Empfänger-GLN**
  (Inbound-Absender ≠ Outbound-Empfänger — bei Dohle 4333228000009 vs. 4316723000002).
- **A6:** Zuordnung eingehender Positionen über Kunden-Artikelnummern; geprüft wird zuerst, ob
  das bestehende `ArticleSupplier.supplierSku` dafür ausreicht (erst suchen, dann bauen).

## API-Oberfläche

Keine neuen Endpunkte. Bestehende 115 Handler werden abgesichert; A5/A6 ändern Verhalten
hinter unveränderten Verträgen.

## Meilensteine

- [x] **M0: Testfundament reparieren** ✅ — `pnpm test` läuft reproduzierbar grün (Commits
      `6d7fa70`, `35aee13`); Vorlage für dynamische `[id]`-Routen vorhanden.
- [ ] **M1: Von außen erreichbare Endpunkte absichern** — A1.1 ✅ (`17592f7`), A1.2 ✅ (`a8fb816`,
      `095470c`, `e6b3d49`); offen: A1.3. Ergebnis: Alle 8 ohne Session
      erreichbaren Routen haben Tests, die unbefugten Zugriff nachweisen; Cron-Secrets
      timing-sicher.
- [ ] **M2: Privilegierte Routen absichern** — Ergebnis: Key-Verwaltung, Admin- und
      Rechte-Routen beweisen 401/403 und Tenant-Isolation.
- [ ] **M3: Geschäftskritische Zustandsübergänge absichern** — Ergebnis: Bestell-Versand
      (inkl. Idempotenz), Freigabe, Wareneingang und Bestandsbuchungen sind testgedeckt.
- [ ] **M4: EDI-Lücken aus dem Live-Betrieb schließen** — Ergebnis: Ausgehende Nachrichten
      tragen die Guide-konforme Empfänger-GLN; eingehende Dohle-Positionen werden zugeordnet.
- [ ] **M5: Struktur & Konsistenz** — Ergebnis: Keine kopierten UI-Helfer mehr, die vier
      500+-LOC-Komponenten sind aufgeteilt, `SECURITY.md` existiert.

---

### A0.1: Entwicklungs-Datenbank auf den zentralen Server konsolidieren ✅
**Warum:** `pnpm test` schlug lokal mit „User was denied access" fehl, obwohl der Code
unverändert war (HEAD `049f908`, `git status` sauber). Ursache: Zwei Postgres-Server stritten um
Port 5432 — der zentrale Entwicklungs-Server (Homebrew 17, mit den Datenbanken der anderen
Projekte) und ein projekteigener Container aus `docker-compose.yml`. Der Container war
**Beiwerk** des Commits `61f87b8` („dockerfile and docker-compose with postgres"), der den
gesamten Stack containerisierte — keine bewusste Entscheidung für einen eigenen Server. Die
anderen Projekte dieser Maschine liegen längst als **eigene Datenbanken auf dem einen Server**;
DocklyLogistics war der Ausreißer. **Entscheidung des Nutzers:** konsolidieren.
**Scope:** Datenbank `docklylogistics` auf dem zentralen Server anlegen und dorthin migrieren.
**Nicht** dazu: die Datenbanken der anderen Projekte anfassen oder Prod-Zugänge ändern.
**Betroffene Stellen:** zentraler Postgres (neue Rolle + Datenbank), `docker-compose.yml`
(Port 55432 statt 5432, damit der Stack-Postgres nie mehr kollidiert), `CLAUDE.md`,
`CONTRIBUTING.md`, `README.md`.
**Akzeptanzkriterien:**
- [x] `pnpm test` läuft grün (47 Dateien / 244 Tests) — auch bei **gestopptem** Container
- [x] Ein zweiter Lauf direkt danach ist ebenfalls grün (kein Zufallstreffer)
- [x] Die Rolle ist **kein** Superuser; sie hält nur `SET ON PARAMETER
      session_replication_role` (nötig fürs Test-Cleanup der Append-only-Trigger)
- [x] Die Datenbanken der anderen Projekte sind unverändert vorhanden
- [x] Das Schema entstand über `prisma migrate deploy` (Migrationskette validiert), 31 Tabellen
**Verifikation:** `pnpm test` 2× bei gestopptem Container; `lsof -iTCP:5432`;
`select rolsuper from pg_roles`
**Abhängigkeiten:** keine · **Aufwand:** S · **Status:** erledigt

> Anmerkung zur Versionsdifferenz: Lokal läuft nun Postgres 17.7, Produktion und CI laufen 16.
> Für diese Codebasis (Standard-SQL, Trigger, Advisory Locks) unkritisch; **die CI bleibt das
> maßgebliche Tor** und prüft weiterhin gegen 16.

### A0.2: Testvorlage für dynamische `[id]`-Routen schaffen
**Warum:** Kein einziger vorhandener Test deckt eine `[id]`-Route ab; der zweite
Handler-Parameter (`{ params: Promise<{id}> }`) hat keine Vorlage. Das ist die erste Hürde für
praktisch jede Folgeaufgabe dieses Plans.
**Scope:** Helfer in `tests/integration/helpers.ts` ergänzen und an einer echten Route
erproben (`GET/PATCH /api/v1/articles/[id]` — die Collection-Route ist bereits getestet, die
Fixtures existieren also schon). Nicht dazu: alle übrigen `[id]`-Routen.
**Betroffene Stellen:** `tests/integration/helpers.ts`, neue
`tests/integration/articles-id.route.test.ts`.
**Akzeptanzkriterien:**
- [ ] Helfer `routeParams(obj)` liefert den Parameter im von Next.js erwarteten Format
- [ ] `GET /api/v1/articles/[id]` liefert 200 für den eigenen Tenant
- [ ] Dieselbe ID liefert 404 (nicht 200) für einen fremden Tenant — Isolationsnachweis
- [ ] `PATCH` als VIEWER liefert 403
**Verifikation:** `pnpm exec vitest run tests/integration/articles-id.route.test.ts`
**Abhängigkeiten:** A0.1 · **Aufwand:** S

### A1.1: Cron-Secret-Prüfung timing-sicher machen
**Warum:** Alle drei internen Cron-Routen vergleichen das Secret mit `!==` (String-Vergleich mit
Früh-Abbruch), während dieselbe Codebasis für API-Keys bereits `timingSafeEqualHex` nutzt — eine
vermeidbare Inkonsistenz an einem Endpunkt, der Webhook-Versand und SFTP-Polling aller Tenants
auslöst.
**Scope:** Gemeinsamer Helfer für die Cron-Auth, in allen drei Routen verwendet. Nicht dazu:
Wechsel des Auth-Verfahrens (Secret bleibt Secret).
**Betroffene Stellen:** `lib/api/cron-auth.ts` (neu), `app/api/internal/audit/seal/route.ts`,
`app/api/internal/webhooks/dispatch/route.ts`, `app/api/internal/edi/sftp-poll/route.ts`;
nutzt `timingSafeEqualHex` aus `lib/services/api-key.ts` (erst suchen, dann bauen).
**Akzeptanzkriterien:**
- [ ] Fehlender Header → 401, falsches Secret → 401, korrektes Secret → 200
- [ ] Fehlendes `CRON_SECRET` in der Umgebung → 503 (bestehendes Verhalten bleibt)
- [ ] Der Vergleich ist längenunabhängig (kein Früh-Abbruch bei abweichendem ersten Zeichen)
- [ ] Alle drei Routen nutzen denselben Helfer (kein kopierter Vergleich mehr im Repo)
**Verifikation:** `pnpm exec vitest run tests/integration/internal-cron.route.test.ts`;
`grep -rn 'got !== expected' app/` liefert keinen Treffer
**Abhängigkeiten:** A0.1 · **Aufwand:** S

### A1.2: EDI-Eingang von außen absichern
**Warum:** `POST /api/edi/as2` und `POST /api/edi/inbound/[token]` sind ohne Session aus dem
Internet erreichbar; beim Token-Weg **bestimmt der Token den Tenant**. Ein Fehler dort ist eine
tenant-übergreifende Dateninjektion. Beide Routen wurden diese Woche mehrfach geändert.
**Scope:** Integrationstests für beide Routen. Nicht dazu: Änderungen an der Krypto-Logik
(die ist über `lib/edi/as2.test.ts` abgedeckt).
**Akzeptanzkriterien:**
- [ ] Unbekannter Token → 401/404, **kein** Datensatz wird angelegt
- [ ] Gültiger Token schreibt ausschließlich in den zugehörigen Tenant
- [ ] AS2 ohne `AS2-From`/`AS2-To` → 400; unbekannte Empfänger-Kennung → 403
- [ ] AS2 mit gültiger Adressierung, aber unbekanntem Partner → signierte Fehler-MDN (200),
      und der Fehlversuch ist im Monitor sichtbar
- [ ] Body über 2 MB → 413
**Verifikation:** `pnpm exec vitest run tests/integration/edi-inbound.route.test.ts`
**Abhängigkeiten:** A0.1 · **Aufwand:** M

### A1.3: Öffentliche Lieferanten-API absichern
**Warum:** Drei Routen laufen auf Lieferanten-API-Keys statt auf einer Session. Kritisch ist,
dass Pfad-Lieferant und Key-Lieferant übereinstimmen müssen — sonst schreibt ein Lieferant im
Namen eines anderen.
**Scope:** `public/v1/orders` (GET), `public/v1/orders/[id]/confirm`,
`public/v1/webhooks/inbound/[supplierId]`.
**Akzeptanzkriterien:**
- [ ] Ohne Key → 401; mit widerrufenem Key → 401; mit Key eines inaktiven Lieferanten → 403
- [ ] Key von Lieferant A auf Pfad von Lieferant B → 403, keine Wirkung
- [ ] GET liefert ausschließlich Bestellungen des Key-Lieferanten
- [ ] `confirm` ohne Scope `orders:confirm` → 403
**Verifikation:** `pnpm exec vitest run tests/integration/public-api.route.test.ts`
**Abhängigkeiten:** A0.1 · **Aufwand:** M

### A2.1: Schlüssel- und Secret-Verwaltung absichern
**Warum:** Diese Routen erzeugen und widerrufen genau die Credentials, die M1 absichert. Ein
fehlgeschlagener Widerruf lässt einen kompromittierten Schlüssel gültig.
**Scope:** Supplier-API-Keys (Anlegen/Widerruf), `me/api-keys` DELETE, die drei
Rotate-Routen (EDI-Token, Partner-Token, Webhook-Secret), AS2-Identität + Zertifikat-Download.
**Akzeptanzkriterien:**
- [ ] Vollschlüssel wird genau einmal beim Anlegen zurückgegeben, nie beim Auflisten
- [ ] Nach Widerruf schlägt Authentifizierung mit demselben Schlüssel fehl (401)
- [ ] Rotation macht den alten Token/Secret ungültig und den neuen gültig
- [ ] Zertifikat-Download liefert nie privates Schlüsselmaterial
- [ ] Jede Route: unterhalb MANAGER → 403; fremder Tenant → 404/403
**Verifikation:** `pnpm exec vitest run tests/integration/keys.route.test.ts`
**Abhängigkeiten:** A0.2 · **Aufwand:** M

### A2.2: Admin- und Rechte-Routen absichern
**Warum:** Die vier `GLOBAL_ADMIN`-Routen sind per Definition tenant-übergreifend — eine
Guard-Regression dort hebelt die Mandantentrennung komplett aus. Die Rechte-Routen schreiben
das Autorisierungsmodell selbst.
**Scope:** `admin/tenants`, `admin/tenants/[id]/features`, `admin/feature-profiles(+[id])`,
`settings/role-features`, `users/[id]/features`.
**Akzeptanzkriterien:**
- [ ] MANAGER (höchste Nicht-Admin-Rolle) auf jeder Admin-Route → 403
- [ ] GLOBAL_ADMIN → 200 und sieht mehr als einen Tenant
- [ ] `PUT role-features` verändert ausschließlich den eigenen Tenant
- [ ] Ungültige Rolle im Payload → 422 (Zod), kein Teilschreiben
**Verifikation:** `pnpm exec vitest run tests/integration/admin.route.test.ts`
**Abhängigkeiten:** A0.2 · **Aufwand:** M

### A3.1: Bestell-Versand inkl. Idempotenz absichern
**Warum:** In `CODE_REVIEW.md` als kritischste Lücke benannt (T1). Der atomare `updateMany`-
Claim verhindert doppelten Versand — ungetestet. Eine Regression bedeutet eine doppelte
Bestellung beim Lieferanten, also echten Warenschaden.
**Scope:** `orders/[id]/send`, `approve`, `cancel`, `receive`.
**Akzeptanzkriterien:**
- [ ] Versand einer freigegebenen Bestellung → 200, Status `SENT`, genau ein Versand-Ereignis
- [ ] **Zweiter Versand derselben Bestellung → kein zweiter Versand** (Idempotenz-Nachweis)
- [ ] Versand ohne Freigabe → 409/422, kein Versand
- [ ] Freigabe als USER → 403
- [ ] Wareneingang schreibt Bestandsbewegung; doppelter Eingang bucht nicht doppelt
**Verifikation:** `pnpm exec vitest run tests/integration/orders-transitions.route.test.ts`
**Abhängigkeiten:** A0.2 · **Aufwand:** L

### A3.2: Bestandsbuchungen absichern
**Warum:** `StockMovement` ist append-only mit Hash-Kette; eine falsche Buchung ist nicht
korrigierbar, nur kompensierbar.
**Scope:** `stock/adjust`, `stock/move`, `stock/inventory`.
**Akzeptanzkriterien:**
- [ ] Korrektur verändert den Bestand um genau den gebuchten Betrag
- [ ] Umlagerung verringert Quelle und erhöht Ziel um denselben Betrag (Summe konstant)
- [ ] Buchung auf fremden Tenant-Artikel → 404, keine Bewegung
- [ ] Negativer Zielbestand → 422 (oder dokumentiertes Ist-Verhalten festgeschrieben)
**Verifikation:** `pnpm exec vitest run tests/integration/stock.route.test.ts`
**Abhängigkeiten:** A0.2 · **Aufwand:** M

### A4.1: Guide-konforme Empfänger-GLN für den EDI-Ausgang
**Warum:** Der HIT-Guide verlangt im UNB **4316723000002** (Dohle Service) als Empfänger,
während Dohle eingehend mit **4333228000009** (HIT) sendet. Das Postfach kennt heute nur *eine*
GLN, die für den Eingangs-Abgleich gebraucht wird — ausgehende Rechnungen würden an die falsche
Adresse gehen. Am 06.07. live festgestellt und dokumentiert.
**Scope:** Optionales Feld „Ausgangs-GLN" am Partner-Postfach inkl. Migration, Nutzung im
Routing, UI-Feld, OpenAPI. Fällt das Feld leer, bleibt das heutige Verhalten.
**Betroffene Stellen:** `prisma/schema.prisma` + Migration, `lib/services/sftp-service.ts`
(`findRelayTarget`), `lib/channels/edi.ts`, `app/(app)/settings/edi-tab.tsx`,
`lib/schemas/edi.ts`.
**Akzeptanzkriterien:**
- [ ] Ist die Ausgangs-GLN gesetzt, trägt die erzeugte Nachricht sie als UNB-Empfänger
- [ ] Ist sie leer, bleibt das bisherige Verhalten unverändert (Rückwärtskompatibilität)
- [ ] Der Eingangs-Abgleich nutzt weiterhin die Eingangs-GLN (keine Vermischung)
- [ ] Ausgangsdateien werden weiterhin korrekt einem Partner zugeordnet
**Verifikation:** `pnpm exec vitest run lib/services/sftp-service.test.ts lib/channels/edi.test.ts`
**Abhängigkeiten:** A0.1 · **Aufwand:** M

### A4.2: Eingehende Positionen über Kunden-Artikelnummern zuordnen
**Warum:** Die echte Dohle-Bestellung 4546877993 kam mit 4 Positionen an — **0 davon konnten
zugeordnet werden**, weil Dohle SAP-Artikelnummern ohne EAN sendet und wir nur gegen EAN und
eigene SKU prüfen. Ohne Zuordnung ist die Bestellung manuell nachzuarbeiten.
**Scope:** Zuordnung um die Kunden-/Lieferanten-Artikelnummer erweitern; zuerst prüfen, ob
`ArticleSupplier.supplierSku` dafür genügt (erst suchen, dann bauen). Nicht dazu: automatische
Anlage unbekannter Artikel.
**Betroffene Stellen:** `lib/services/edi-service.ts` (`processInboundOrders`), ggf. Schema.
**Akzeptanzkriterien:**
- [ ] Position mit bekannter Kunden-Artikelnummer wird zugeordnet
- [ ] Reihenfolge bleibt: EAN vor eigener SKU vor Kunden-Artikelnummer
- [ ] Unbekannte Nummer bleibt unzugeordnet (kein Falsch-Treffer), Nachricht bleibt PROCESSED
- [ ] Die Zuordnung ist tenant-gescoped (fremde Zuordnung greift nicht)
**Verifikation:** `pnpm exec vitest run lib/services/edi-service.test.ts`
**Abhängigkeiten:** A0.1 · **Aufwand:** M

### A5.1: Kopierte UI-Helfer zusammenführen
**Warum:** `Kpi` ist in 4 Dateien identisch nachgebaut, `STATUS_STYLES` in 6 leicht abweichend —
sie ändern sich aus demselben Grund (neuer Status), aber an sechs Stellen. `components/ui/`
enthält bereits `StatusPill`, `DetailField`, `FlashBanner`.
**Scope:** Gemeinsame `Kpi`-Komponente; Status-/Kanal-Stile aus einer Quelle. Zufällig ähnlicher
Code wird nicht zwangsvereinheitlicht (CLAUDE.md-Regel).
**Akzeptanzkriterien:**
- [ ] `grep -c 'function Kpi'` über `app/` liefert 0 (nur noch die gemeinsame Komponente)
- [ ] Optik unverändert: Screenshot-Vergleich je betroffener Seite, Desktop und Mobil
- [ ] Alle Status-Werte inkl. `DUPLICATE` haben genau eine Stil-Definition
**Verifikation:** `pnpm build && pnpm test`; visuelle Prüfung der 6 Seiten in beiden Viewports
**Abhängigkeiten:** M1–M3 abgeschlossen · **Aufwand:** M

### A5.2: Große View-Komponenten aufteilen
**Warum:** Vier Komponenten mit 570–703 Zeilen mischen Datenabruf, Formularzustand,
Unterdialoge und Darstellung — schwer testbar und die häufigste Konfliktquelle.
**Scope:** `warehouse-mode-view` (703), `article-detail-modal` (703), `edi-tab` (581),
`webhooks-tab` (576) in Unterkomponenten/Hooks zerlegen. Reines Refactoring, kein
Verhaltenswechsel, ein Commit je Komponente.
**Akzeptanzkriterien:**
- [ ] Keine der vier Dateien überschreitet 300 Zeilen
- [ ] Verhalten und Optik unverändert (vorher/nachher je Seite geprüft)
- [ ] Kein neuer Prisma-Aufruf in einer Komponente (Schichtregel)
**Verifikation:** `pnpm build && pnpm test`; manueller Durchstich je Seite
**Abhängigkeiten:** A5.1 · **Aufwand:** L

### A5.3: SECURITY.md aus dem Ist-Zustand ableiten
**Warum:** Die Datei fehlt als einzige der Regeldateien. Sie soll die real geltenden Regeln
festhalten (Auth über eine Quelle, Tenant-Isolation, append-only Audit, Secret-Verwaltung,
Cron-Endpunkte) — abgeleitet aus dem Code, nicht generisch.
**Akzeptanzkriterien:**
- [ ] Jede Regel verweist auf die Stelle, die sie durchsetzt
- [ ] Der Umgang mit `.deploy-secrets/` und `APP_KEY` ist dokumentiert
- [ ] Kein Secret-Wert steht in der Datei
**Verifikation:** Review gegen `lib/api/guard.ts`, `lib/crypto`, `middleware.ts`
**Abhängigkeiten:** keine · **Aufwand:** S

## Risiken & offene Fragen

| Risiko | Auswirkung | Umgang |
|---|---|---|
| Umzug des DB-Containers | Lokale Testdaten unbrauchbar | Named Volume bleibt erhalten; Rückweg = Container auf 5432 neu anlegen |
| Tests schreiben Fehlverhalten fest | Bug wird zementiert | Auffälligkeiten werden als eigener Fund gemeldet, nicht im selben Schritt „gefixt" |
| A4.1 ändert Live-EDI-Routing | Fehlgeleitete Nachrichten an Dohle | Feld ist optional; leer = heutiges Verhalten. Prod-Deploy nur nach Freigabe |
| A5.2 (UI-Split) ohne UI-Tests | Unbemerkte Regression | Playwright fehlt — daher kleine Schritte + manuelle Prüfung je Komponente |
| **Offen:** Soll Playwright eingeführt werden? | UI bleibt manuell geprüft | Entscheidung des Nutzers; steht unter „Später" |

### A3.0: Bestellnummern pro Mandant eindeutig ✅ (`caa6773`)
**Warum:** Beim Seeden aufgefallen: `nextOrderNo()` zählt je Mandant, `Order.orderNo` trug aber
einen **globalen** Unique-Index. Der zweite Mandant, der im selben Jahr eine Bestellung anlegt,
berechnet dieselbe Nummer und scheitert. Produktion war nur deshalb nicht betroffen, weil zwei
der drei Mandanten noch gar keine Bestellungen haben.
**Akzeptanzkriterien:** alle erfüllt — zwei Mandanten dürfen `ORD-JJJJ-0001` führen, je Mandant
wird unabhängig weitergezählt, Doppelvergabe innerhalb eines Mandanten bleibt verboten.
**Verifikation:** Wirksamkeit beidseitig belegt (alter Index → `Unique constraint failed on the
fields: (orderNo)`, neuer Index → grün); Migration tauscht nur Indizes.
**Status:** erledigt · **Prod-Migration:** offen, braucht Freigabe

### A3.3: Testrückstände in der Entwicklungs-Datenbank vermeiden
**Warum:** Testdateien löschen ihren Mandanten, aber `AuditLog` und `OrderEvent` sind
append-only und bleiben ohne Trigger-Umweg liegen. Nach den heutigen Läufen lagen Einträge von
vier längst gelöschten Testmandanten in der Datenbank — wächst mit jedem Lauf.
**Scope:** Gemeinsamer Cleanup-Helfer, der die Append-only-Tabellen mandantenscharf mitentfernt;
Nutzung in allen DB-gestützten Testdateien.
**Akzeptanzkriterien:**
- [ ] Nach einem vollständigen Suite-Lauf liegen keine Zeilen von `test-*`-Mandanten mehr vor
- [ ] Der Helfer aktiviert die Trigger im `finally` zuverlässig wieder
- [ ] Bestehende Tests bleiben grün
**Abhängigkeiten:** keine · **Aufwand:** S

## Später

- Playwright-E2E-Setup (Login-Flow, Bestelldurchstich, Mobile-Viewport).
- Coverage-Schwelle als CI-Gate, sobald die Routen abgedeckt sind.
- DESADV-Unterstützung (HIT-Guide fordert sie fürs Streckengeschäft).
- Van-Haag-Einkaufspreise (aktuell 0,00 € — Preisliste liegt nicht vor).
- Artikel-Lagerplatz-Zuordnung für Tenant `daube` (Codierung angelegt, Zuordnung offen).
- Stop-Hook-Laufzeit (claude-mem, Median ~10 s) — Werkzeugkette, nicht Anwendung.

---

# Vorhaben 2026-10-16: Menü-Umbau nach den neuen Shell-Vorgaben

## Ziel
Menü und Shell auf die verbindlichen Dockly-Vorgaben bringen (`design-dockly.md` → Menü-Anatomie,
`apple-struktur.md` → Navigationsmodell, `plattform/06-profilmenue.md`). Heute: flache Liste mit
12 Einträgen ohne Gruppen, statische Nutzer-Plakette statt Profil-Auslöser, selbstgebautes
Dropdown ohne Tastaturführung, mobil nur ein Vollbild-Hamburger ohne Tab-Bar.

**Baseline:** 53 Testdateien / 291 Tests grün, CI auf `37166ba` grün. Modus B.

## Ist → Soll

| Baustein | Ist | Soll |
|---|---|---|
| Registry | `components/layout/nav-items.ts`, flach, 12 Einträge | `lib/navigation.ts` mit **3 Gruppen**, speist Sidebar, Drawer, Tab-Bar und ⌘K |
| Brand-Kopf | Logo-SVG / Marken-PNG | Gold-Kachel + Wortmarke + Untertitel (Asset `brand.tsx` kopiert, Name angepasst) |
| Unter dem Logo | — | statischer Mandanten-Chip (Initialen-Kachel + Name) |
| Nav-Zeilen | 1 Liste, Kante links | Gruppen-Label in Caps, Zeilen ~36–40 px, aktive Zeile als Kapsel |
| Sidebar-Fuß | statische Plakette | **Profil-Auslöser** (Avatar, Name, `Rolle · Mandant`, `ChevronsUpDown`) → Menü nach oben |
| Profilmenü | eigenes Dropdown, ohne Fokus-/Pfeiltastenführung | Radix `DropdownMenu`, **ein** `ProfileMenuContent`, zwei Auslöser |
| Initialen / Rolle | zweimal unterschiedlich berechnet, roher Enum | eine Hilfsfunktion; Rolle übersetzt („Manager") |
| Abmelden | nur `signOut` | zusätzlich Service-Worker-Caches leeren |
| Mobil | Hamburger-Vollbild | schwebende **Tab-Pill** (4 Bereiche + Suche), minimiert beim Scrollen; Drawer bleibt für den Rest |
| Topbar-Avatar | 32 px überall | 44 px mobil, 32 px ab `md` |

## Gruppierung (Vorschlag, Gate 1)

1. **Einkauf:** Dashboard · Bestellvorschläge · Bestellungen · EDI-Monitor · Reports
2. **Lager:** Lager & Bestand · Lagermodus (Scan) · Artikel / Rohstoffe · Lieferanten
3. **Verwaltung:** Audit · Einstellungen · Administration

**Tab-Bar mobil (max. 5 inkl. Suche):** Dashboard · Bestellungen · Lagermodus · Lager & Bestand · Suche.
Fehlt einem Nutzer ein Bereich (Feature-Rechte), rückt nichts nach — die Pill wird kürzer.

## Fundament-Funde (Modus B — werden nicht still nachgerüstet)

- **i18n fehlt** (kein next-intl): Der Menüpunkt „Sprache" im Profilmenü entfällt; Labels bleiben
  deutsch in der Registry, dort aber zentral — ein späterer i18n-Meilenstein tauscht sie gegen Keys.
- **Tenant-Wechsler für GLOBAL_ADMIN fehlt** (`tenant-switcher.md`) — eigenes Vorhaben, unter „Später".
- **Keycloak-Abmeldung am Realm** (end-session mit `id_token`) fehlt; heute endet nur die lokale
  Sitzung. Auth-Änderung mit Hin- und Rückweg-Prüfung → eigene Aufgabe, nur auf Freigabe.
- **Glocke** ist ein Eigenbau ohne Radix/Polling — gleiche Schwäche wie das Profilmenü; unter „Später".
- **Komponententests:** Vitest läuft in `node`, `@testing-library/react` fehlt (jsdom ist installiert).

## Arbeitsweise
Planung und Review: Opus 5.5. Umsetzung je Aufgabe durch einen Sonnet-5.5-Agenten (TDD: roter Test
zuerst), danach Review + Verifikation (tsc, lint, Suite) durch Opus, ein Commit je Aufgabe.

## Meilensteine

- [x] **N1: Registry & Desktop-Sidebar nach Anatomie** ✅ (`3031d92`, `af833c3`, `aed2ca4`, `4f39abb`) — Ergebnis: Sidebar zeigt Brand-Kopf,
      Mandanten-Chip und drei Gruppen; ⌘K und Drawer nutzen dieselbe Registry.
- [x] **N2: Profilmenü — ein Inhalt, zwei Auslöser** ✅ (`4904ae5`, `eb09f43`, `1e8b4e4`) — Ergebnis: Sidebar-Fuß und Topbar-Avatar
      öffnen dasselbe tastaturbedienbare Menü (Kopf, Farbschema, Abmelden).
- [x] **N3: Mobile Tab-Pill** ✅ (`98ea9f9`, `00bb3a7`) — Ergebnis: auf dem Handy vier Bereiche + Suche unten, minimiert beim
      Scrollen; Drawer spiegelt die Gruppen inklusive Profil-Fuß.
- [ ] **N4 (Freigabe nötig): Deploy** — Image bauen, VM, Verify `login=200`, Sichtprüfung.

### N1.1: Nav-Registry mit Gruppen und Ableitungen anlegen
**Warum:** Eine Definition muss Sidebar, Drawer, Tab-Bar und ⌘K speisen (apple-struktur.md).
**Scope:** `lib/navigation.ts` (id, label, href, icon, group, tab-Flag, accent); reine Funktionen
`navGroups(allowed)`, `tabItems(allowed)`, `activeNavId(pathname)` (längster Präfix gewinnt);
`nav-items.ts` wird zum Re-Export, damit `lib/features.ts`-Bezüge stabil bleiben.
**Akzeptanzkriterien:**
- [ ] Gruppenreihenfolge Einkauf → Lager → Verwaltung; leere Gruppen werden ausgelassen
- [ ] `tabItems` liefert höchstens 4 Bereiche, nur erlaubte, in Registry-Reihenfolge
- [ ] `activeNavId("/orders/abc")` = `orders`; `/order-suggestions` trifft **nicht** `orders`
- [ ] Alle 12 bisherigen IDs existieren weiter (Feature-Rechte bleiben gültig)
**Verifikation:** `pnpm exec vitest run lib/navigation.test.ts` · **Aufwand:** S

### N1.2: Initialen- und Rollen-Helfer vereinheitlichen
**Akzeptanzkriterien:** `initials("Jonathan Fahlbusch")`=`JF`; leer → `?`; Kleinschreibung → groß;
`roleLabel("GLOBAL_ADMIN")`=„Plattform-Admin", `MANAGER`=„Manager", `USER`=„Benutzer",
`VIEWER`=„Leser"; unbekannt → Rohwert. **Aufwand:** S

### N1.3: Sidebar nach Menü-Anatomie umbauen
**Scope:** Brand-Kopf aus Skill-Asset (`dockly LOGISTICS`, Untertitel „Rohstoff-Logistik"),
Mandanten-Chip, Gruppen-Labels, Kapsel-Aktivzustand über `--sidebar-accent`/Gold, ⌘K-Palette
gruppiert. Keine Aktions-Buttons in der Sidebar.
**Akzeptanzkriterien:**
- [ ] Reihenfolge Brand → Chip → Gruppen → Leerraum → Fuß → Einklappen
- [ ] Eingeklappt: nur Kachel, Icons mit Tooltip, Gruppen-Labels ausgeblendet
- [ ] Feature-Rechte wirken weiter (verbotener Bereich erscheint nirgends)
- [ ] Hell/Dunkel geprüft, Kontrast der Gruppen-Labels ≥ 4.5:1 auf Navy
**Verifikation:** tsc/lint/Suite; Sichtprüfung im Browser-Pane (Desktop, Hell + Dunkel) · **Aufwand:** M

### N2.1: Komponententests ermöglichen
**Scope:** `@testing-library/react` + `@testing-library/user-event` als devDependencies,
`components/**/*.test.tsx` in die Vitest-`include`, jsdom pro Datei (`// @vitest-environment jsdom`).
**Akzeptanzkriterien:** ein Smoke-Komponententest läuft lokal und in der CI. **Aufwand:** S

### N2.2: `ProfileMenuContent` mit Radix bauen
**Akzeptanzkriterien:**
- [ ] Inhalt in Reihenfolge: Kopf (Name, E-Mail, `Rolle · Mandant` mit Mandant als Mono-Pill) →
      Farbschema → Abmelden (rot, eigene Gruppe)
- [ ] Rolle erscheint übersetzt, nicht als Enum
- [ ] Menü per Tastatur bedienbar (Enter öffnet, Pfeile, Escape schließt, Fokus zurück am Auslöser)
- [ ] Abmelden leert die Service-Worker-Caches vor dem Absenden
**Verifikation:** Komponententests (jsdom) · **Aufwand:** M

### N2.3: Zwei Auslöser verdrahten
**Akzeptanzkriterien:**
- [ ] Topbar-Avatar ganz rechts (rechts neben der Glocke), 44 px mobil / 32 px ab `md`
- [ ] Sidebar-Fuß als Auslöser, öffnet nach oben; eingeklappt nur Avatar mit Tooltip
- [ ] Beide rendern dieselbe Komponente (ein Import, keine Kopie)
- [ ] Alte Komponenten `sidebar-user.tsx` und das Eigenbau-Dropdown sind entfernt
**Aufwand:** S

### N3.1: Schwebende Tab-Pill für Mobil
**Akzeptanzkriterien:**
- [ ] Nur unter `md` sichtbar; Einträge aus `tabItems` + Such-Tab (öffnet ⌘K-Sheet)
- [ ] Aktiver Tab als Kapsel mit Icon + Label; Touch-Ziele ≥ 44 px
- [ ] Minimiert beim Herunterscrollen, kehrt beim Hochscrollen zurück; bei
      `prefers-reduced-motion` ohne Animation
- [ ] `env(safe-area-inset-bottom)` berücksichtigt; Inhalt wird nicht verdeckt (Polster unten)
- [ ] Kein Profil-Tab
**Verifikation:** Komponententest der Scroll-Logik (Hook) + Sichtprüfung Mobile-Viewport · **Aufwand:** M

### N3.2: Drawer spiegelt die Anatomie
**Akzeptanzkriterien:** Drawer zeigt Brand, Chip, dieselben Gruppen, Profil-Fuß am Ende; schließt bei
Navigation. **Aufwand:** S

### N3.3 (optional, nur auf Freigabe): Abmelden auch bei Keycloak
**Warum:** Heute bleibt die Keycloak-Sitzung bestehen — wer „Abmelden" drückt, ist beim nächsten
Login sofort wieder drin. **Risiko:** Auth-Änderung; Hin- und Rückweg auf Prod prüfen.

## Nebenbefunde während der Umsetzung (eigene Commits)
- **Schrift:** `--font-sans: var(--font-sans)` im `@theme inline` war ein Zyklus — die App lief seit 12.05. in Times. Behoben `07c20de`, Regressionstest.
- **⌘K ignorierte Feature-Rechte** — behoben `aed2ca4`.
- **Trigger-Rennen in Tests (A3.3):** sechs Dateien schalteten Append-only-Trigger global ab → Flakes + Rückstände. Behoben mit `purgeAppendOnly()`.
- **Mock-Login fehlt** (Skill-Fundament): lokale Sichtprüfung nur mit echtem Keycloak möglich — unter „Später".

## Risiken
- Optische Änderung an jeder Seite → Sichtprüfung Desktop/Mobil × Hell/Dunkel vor Deploy.
- Tab-Pill verdeckt Inhalte am Seitenende → Polster unten als Akzeptanzkriterium.
- Brand-Kopf ersetzt das bisherige Logo → Entscheidung an Gate 1.

## Fortsetzung 2026-10-16: Menü vollständig nach Vorgabe („mach alles fertig")

Die an Gate 1 vertagten Bausteine werden auf Anweisung des Nutzers nachgezogen. Annahme
(Skill-Standard, nicht ausdrücklich bestätigt): Sprachen **Deutsch (Quelle) + Englisch**.

- [x] **N5: Tenant-Wechsler für GLOBAL_ADMIN** ✅ (`12cd364`, `d80b56e`, `725a1c6`) (`tenant-switcher.md`) — Session-Cookie, zwei
      Read-Points über `resolveSessionTenant`, signierter `x-user-tenant`, `homeTenant` getrennt,
      Audit im Ziel-Mandanten, durchsuchbares Popover unter dem Logo (Sidebar + Drawer), Warnfärbung
      bei Fremdansicht, Cookie-Löschung bei Abmelden und SSO-Einstieg.
- [x] **N6: Notificationcenter** ✅ (`dbdf3cb`, `6e7dfb7`, Fix `5d77e96`) (`plattform/08-notificationcenter.md`) — Radix, Lesestatus je
      Nutzer (`NotificationRead`), stabile Sortierung, Aktualisierung bei Fokus + alle 60 s.
- [x] **N7: Abmelden am Keycloak-Realm** ✅ (`4648130`) — Hin-/Rückweg: manuelle Prüfung durch Nutzer offen (`plattform/06-profilmenue.md`) — `id_token` nur im JWT,
      end-session-URL, Hin- und Rückweg auf Prod geprüft.
- [~] **N8: Mehrsprachigkeit** — **auf Entscheidung des Nutzers vorerst gestrichen** (16.10.2026).
      Umfang wäre die komplette Oberfläche (82 Dateien, ~12.900 Zeilen) plus geänderte URLs (`/de`, `/en`).
      Folge: kein Punkt „Sprache" im Profilmenü; einzige bewusste Abweichung von `06-profilmenue.md`.
