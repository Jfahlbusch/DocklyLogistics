# Code-Review: DocklyLogistics — 2026-06-22

## Zusammenfassung

DocklyLogistics ist eine durchdacht gebaute, sicherheitsbewusste Multi-Tenant-Anwendung (Next.js 15 / TypeScript / Prisma) auf **M6-Niveau** (Stammdaten, Bestand/Lagermodus, Bestellungen, Integration, Audit-Chain, Reports). Die Architektur ist konsistent: saubere Schichtung (`lib/{api,auth,audit,channels,crypto,db/repos,pdf,schemas,services}`), API-first für alle **Schreib**-Operationen, deterministische Hash-Chain mit Append-only-DB-Triggern, solide Krypto (AES-GCM, timing-safe HMAC), durchgängiges Tenant-Scoping in den Standard-Repos. **109 Unit-Tests sind grün** (Sicherheitsnetz vorhanden).

Die größten Risiken sind: (1) ein **Race in der Bestellnummern-Vergabe** (Datenintegrität), (2) der **nicht-idempotente Versand** (Doppelversand-Risiko), (3) die **fehlende User-API-Key-Governance** (Skill-Kernanforderung nicht erfüllt). Die größten Wartungs-Hebel sind massive UI-Duplikation (Field 8×, Kpi 4×, STATUS_STYLES 5×, Flash-Banner 8×, Fehler-Extraktion 22×) und ~30× kopierte Actor-/Audit-Blöcke im Backend. Tests fehlen für Route-Handler, E2E und integritätskritische Module (webhook-worker, audit/seal, audit/verify). Doku ist auf M1 eingefroren; CLAUDE/ARCHITECTURE/CONTRIBUTING fehlen.

## Funde

| # | Kategorie | Schwere | Fundort | Beschreibung | Empfehlung |
|---|-----------|---------|---------|--------------|------------|
| 1 | Korrektheit/Race | **Kritisch** | `lib/services/order-number.ts:8-24` `nextOrderNo` | Kommentar behauptet „advisory lock / SELECT FOR UPDATE", Code macht nur `findFirst`+`parseInt`+1. Zwei gleichzeitige `POST /orders` oder `bulk-confirm` im selben Jahr/Tenant → doppelte `orderNo` / Unique-Verletzung. | `pg_advisory_xact_lock(hashtext(tenantId||year))` via `tx.$executeRaw`, oder DB-Sequence + Retry. Falschen Kommentar entfernen. |
| 2 | API-Key-Governance | **Kritisch** | `prisma/schema.prisma` (`SupplierApiKey`), `app/api/v1/suppliers/[id]/api-keys/*` | Nur **Lieferanten-Keys** für die Public-API. Keine **persönlichen User-Profil-Keys** (kein `UserApiKey`, keine `/me/api-keys`, keine Profil-UI). Skill-Anforderung „jeder User generiert im Profil einen auf seine Rechte gescopten Key" **nicht erfüllt**. | `UserApiKey`-Model + `/api/v1/me/api-keys` + Profil-Tab; Scopes aus User-Rolle abgeleitet. |
| 3 | Idempotenz | **Hoch** | `app/api/v1/orders/[id]/send/route.ts:31-84` | PDF-Render **und** echter Versand (`dispatchOrder`) laufen **vor** der `transition→SENT`-Transaktion. Schlägt die Transaktion fehl, ist real verschickt aber nicht SENT → Doppelversand beim Retry. | Outbox-Muster (wie Webhooks) oder `SENDING`→dispatch→`SENT` mit Idempotenzschlüssel. |
| 4 | Rechte-Architektur | **Hoch** | `lib/auth/role.ts` vs. `lib/schemas/api-key.ts:4` | **Zwei parallele Rechtequellen** ohne Mapping: interne Rollen (`GLOBAL_ADMIN…VIEWER`) vs. Public-Scopes (`orders:read…`). Interne `/api/v1`-Routen akzeptieren keinen API-Key. Programmatischer Zugriff mit User-Rechten unmöglich. | Gemeinsame Capability-Quelle; Scopes aus Rolle ableiten. |
| 5 | Wiederverwendung (UI) | **Hoch** | 5× identischer `Field` (article-form:242, supplier-form:200, location-form:131, channel-form:179, article-supplier-form:193, MD5-gleich) + 3× Detail-Variante | 8 lokale `Field`-Definitionen. | Geteilte `components/ui/field.tsx` (`FormField` + `DetailRow`). ~120 LOC weg. |
| 6 | Wiederverwendung (UI) | **Hoch** | `STATUS_STYLES` 5× (orders-view:23, order-detail-modal:46, supplier-detail-modal:278, suggestions-view:27, webhooks-tab:41), `CHANNEL_STYLES` 2×, Badge-Markup ~8× | Status-Pill-Maps + Markup vielfach kopiert. | `lib/ui/status.ts` + `<StatusPill>`-Komponente. |
| 7 | Wiederverwendung (UI) | **Hoch** | `Kpi` 3× (article-detail-modal:589, warehouse-mode:543, order-detail-modal:254) + reports-view | Fast identische KPI-Karten. | Geteilte `<Kpi label value variant?>`. |
| 8 | Wiederverwendung (UI) | **Hoch** | Flash-State `{ok,text}` 8× + Banner-JSX 9× (stock/suppliers/articles/suggestions/settings/webhooks/warehouse/order-detail) | Identisches Banner überall handgebaut. | `<FlashBanner>` + `useFlash()`-Hook. |
| 9 | Korrektheit/Drift | **Hoch** | `warehouse-mode-view.tsx:236-240` vs. `lib/services/suggestion-engine.ts:68-69` | Bestellmengen-Formel `ceil(shortfall/packFactor)` **wortgleich** client+server dupliziert → Drift-Risiko. | `computeOrderQty()` nach `lib/services/order-math.ts`, beidseitig importieren. |
| 10 | Überlange Komponente | **Hoch** | `app/(app)/articles/article-detail-modal.tsx` (709 LOC) | Artikel-Fetch + 4 Tabs + Lieferanten-CRUD-Tabelle + Barcode-Print-HTML-String + `StockPanel` in einer Datei. | Extrahieren: `ArticleSupplierTable`, `ArticleBarcodeTab`, `StockPanel`, `useArticleDetail`. |
| 11 | Überlange Komponente | **Hoch** | `app/(app)/warehouse-mode/warehouse-mode-view.tsx` (703 LOC) | Kamera-Lifecycle + Offline-Queue + Fetch + `AdjustModal` gemischt. | `useBarcodeScanner()`, `useOfflineScanQueue()`-Hooks, `AdjustModal` auslagern. |
| 12 | Tests | **Hoch** | `app/api/**` (alle ~50 Routes) | **Keine Route-Handler-Tests** (Auth-401/403, 422, Tenant-Scoping ungetestet). | Integrationstests pro Route. |
| 13 | Tests | **Hoch** | `package.json`, CI | **Kein E2E/Playwright** umgesetzt (war für M7 geplant). | Playwright nachziehen oder Anspruch in Doku als offen markieren. |
| 14 | Tests (kritisch) | **Hoch** | `lib/services/webhook-worker.ts`, `lib/audit/seal.ts`, `lib/audit/verify.ts` | Integritäts-/Sicherheitskritisch und **ungetestet** (Backoff, Seal-Idempotenz, **Manipulations-Verify**). | Tests für Backoff, Seal-Idempotenz, Verify-Mismatch. |
| 15 | Tenant-Isolation | **Mittel** | `lib/db/repos/article-supplier.ts` (ganze Datei) | Einziges Repo **ohne `tenantId`** — Schutz nur im Route-Layer. Defense-in-Depth fehlt. | `tenantId` in Repo-Signaturen aufnehmen. |
| 16 | Wiederverwendung (Backend) | **Mittel** | 29 Mutations-Handler: identischer Actor-Block + **doppelte Auth** (`requireRoleFromHeaders` + `auth()`) | 29× kopiert, 2× Session-Resolve/Request. | `getActor(req)`-Helper. |
| 17 | Wiederverwendung (Backend) | **Mittel** | `appendAudit(tx,{…})` 35× nach Mutationen, `ip/userAgent` inkonsistent (approve ohne, articles mit) | Transaktion+Audit handverdrahtet, inkonsistente Felder. | `withAudit()`/`mutate()`-Wrapper. |
| 18 | Magische Strings | **Mittel** | stock-`reason` (`MOVE_IN/OUT/RECEIPT` frei) vs. `StockAdjustSchema` (`CORRECTION…`); Event-Typen (`STATUS_CHANGED` vs `SEND/CANCEL/RECEIVE` uneinheitlich); Webhook-Event-Namen | Verstreute String-Literale, kein zentraler Enum/Union; Tippfehler ungefangen. | Prisma-Enum + `as const`-Unions in `lib/schemas`/`lib/events`. |
| 19 | Wiederverwendung (UI) | **Mittel** | `body.detail ?? body.title` **22×** in 12 Dateien | Fehler-Extraktion handkopiert, teils ohne `.catch`. | `extractError(res)` in `lib/api/problem.ts`. |
| 20 | a11y/Konsistenz | **Mittel** | 5 Custom-Overlays (`fixed inset-0`): AdjustModal, CreateKeyDialog, CreateWebhookDialog, DeliveryDialog, ReceiveModal | Kein Focus-Trap/Escape/`aria-modal`/Scroll-Lock (anders als shadcn `Dialog`). | Auf shadcn `Dialog` migrieren. |
| 21 | Toter Code/Konsistenz | **Mittel** | `components/ui/form.tsx` + `ui/select.tsx` **nirgends genutzt**; 10 Dateien mit rohem `<select>` | Design-System-Primitives ungenutzt; native Controls inkonsistent. | `ui/select` konsequent nutzen oder `<NativeSelect>`; `ui/form.tsx` löschen. |
| 22 | API-Parität | **Mittel** | `app/(app)/dashboard/page.tsx:17-42`, `app/(app)/reports/page.tsx` | Dashboard-KPIs **ohne** Endpunkt; Reports-Summary-Endpunkt existiert, wird in UI aber **umgangen**. Headless-Konsumenten erhalten Aggregate nicht. | `/api/v1/dashboard` ergänzen; Reports-View `/reports/summary` nutzen lassen. |
| 23 | Doku | **Mittel** | `README.md` | Behauptet „Phase M1: nur Tenant+User", listet M2–M6 als offen; tote Pfade (`../docs/...`). Code ist M6. | README auf M6 aktualisieren, Pfade fixen. |
| 24 | Doku | **Mittel** | Repo-Root | Kein `CLAUDE.md`/`ARCHITECTURE.md`/`CONTRIBUTING.md`. | Anlegen (Phase 5). |
| 25 | Magische Konstante (UI) | **Mittel** | Channel-Liste `["EMAIL","API","EDI"]` 5× | Verstreut. | `lib/channels/constants.ts` als Single Source. |
| 26 | Lange Funktion | **Mittel** | `app/api/v1/order-suggestions/bulk-confirm/route.ts:11-82` | ~70 Zeilen, mehrere Verantwortlichkeiten; ruft `nextOrderNo` je Gruppe → verstärkt Fund #1. | In `suggestionService.confirmBulk()` auslagern. |
| 27 | Fehlerbehandlung | **Niedrig** | 7 Routes lokales `try/catch` (approve/cancel/send/receive/stock-adjust/move/public-confirm), 404-vs-409 per `e.message === "Not Found"` | Umgeht `handler()`, String-Vergleich fragil. | Domänenfehler zentral in `handler()` mappen; `notFound`-Flag statt Message. |
| 28 | Fehlerbehandlung | **Niedrig** | `lib/services/order-service.ts:81` `enrichItems` wirft generisches `Error` | Client-Input-Fehler landet als **500** statt 422/404. | Typisierte Fehlerklasse → 422. |
| 29 | Fehlerbehandlung | **Niedrig** | `app/api/v1/orders/[id]/receive/route.ts` `e.message.startsWith("Kein Lagerplatz")` | Fragile String-basierte Fehlerklassifikation. | `MissingLocationError`-Klasse. |
| 30 | Sonderlocke | **Niedrig** | `lib/services/suggestion-engine.ts:27-33` | Aggregation aus `stockRepo.totalsByArticle` reimplementiert (weil `prisma` statt `tx`). | `totalsByArticle(ids, tx=prisma)` parametrisieren, teilen. |
| 31 | Korrektheit (UI) | **Niedrig** | `app/(app)/dashboard/page.tsx:96` | `minStock - stock` **ohne** `Math.max(0,…)` → kann „offen -3" anzeigen. | Via `computeShortfall()` (Fund #9) mitlösen. |
| 32 | Backoff-Duplikat | **Niedrig** | `lib/db/repos/webhook.ts` `markFailedRetryLater` vs. `webhook-worker.ts` | Backoff-Konstanten/Logik an zwei Stellen → Drift. | Eine Quelle. |

## Strukturbewertung

**Ist-Struktur (gut):** Klare Schichtung — `app/(app)` (UI, Server-Components laden, Client-Views interagieren), `app/api/{v1,public/v1,internal}` (HTTP), `lib/db/repos` (tenant-scoped Datenzugriff), `lib/services` (Domänenlogik), `lib/schemas` (Zod+OpenAPI), `lib/{audit,crypto,channels,pdf,barcode}` (Querschnitt). Mutationen laufen sauber durch API → Repo → Audit.

**Soll-Verbesserungen:** (a) Eine **UI-Primitives-Schicht** (`components/ui/field`, `kpi`, `status-pill`, `flash-banner`) + `lib/ui/status.ts` gegen die Duplikation. (b) Eine **Backend-Mutations-Hilfe** (`getActor`, `withAudit`) gegen die 29×/35×-Kopien. (c) Eine **gemeinsame Berechnungs-Schicht** `lib/services/order-math.ts` (Mengen/Unterdeckung) als Single Source für Client+Server. (d) Zentrale **Enum/Konstanten** (stock-reason, order-event, webhook-event, channel-list).

## Test- und Doku-Lücken

**Tests:** Keine Route-Handler-Tests (~50 Routes); kein E2E/Playwright; ungetestet: `webhook-worker`, `audit/seal`, `audit/verify`, `channels/*` (inkl. manueller EDIFACT-String-Bau), Repos `order`/`order-suggestion`/`webhook`/`api-key`, `order-number`. Vorhandene Tests großteils gut (Fehlerpfade in 15/19), 2 flach (`storage-location`, `reports`).

**Doku:** README inhaltlich M1 (Code M6), tote Pfade. Kein CLAUDE.md/ARCHITECTURE.md/CONTRIBUTING.md/SECURITY.md. OpenAPI/Scalar gut (zwei Specs + zwei Referenzseiten). Specs/Plans M1–M6 liegen außerhalb des Repos unter `../Docs/superpowers/`.

## Empfohlene Maßnahmen (priorisiert)

**Block A — Korrektheit/Sicherheit (Verhalten ändert sich, getrennt von Refactoring):**
1. Fund #1 `nextOrderNo` Race fixen (Advisory-Lock). *Aufwand S, Risiko mittel.*
2. Fund #3 Versand idempotent machen. *Aufwand M, Risiko mittel.*
3. Fund #15 `article-supplier` tenant-scopen. *Aufwand S, Risiko niedrig.*

**Block B — Wartbarkeit/Refactoring (kein Verhaltensänderung, testgesichert):**
4. Fund #9/#31 `lib/services/order-math.ts` (computeOrderQty/Shortfall). *S, niedrig.*
5. Fund #5/#7/#8 UI-Primitives `Field`/`Kpi`/`FlashBanner`. *M, niedrig.*
6. Fund #6 `lib/ui/status.ts` + `StatusPill`. *S, niedrig.*
7. Fund #19 `extractError`. *S, niedrig.*
8. Fund #16/#17 `getActor` + `withAudit`. *M, mittel.*
9. Fund #18/#25 zentrale Enums/Konstanten. *S, niedrig.*
10. Fund #10/#11 Große Komponenten aufteilen. *L, niedrig.*
11. Fund #20 Custom-Overlays → shadcn Dialog. *M, niedrig.*

**Block C — Tests/Doku:**
12. Fund #14 Tests für webhook-worker/seal/verify. *M, niedrig.*
13. Fund #12 Route-Handler-Tests (Kernrouten). *L, niedrig.*
14. Fund #23 README aktualisieren. *S, niedrig.*
15. Phase 5: CLAUDE.md/ARCHITECTURE.md/CONTRIBUTING.md. *M, niedrig.*

**Block D — Architektur-Entscheidung (Rückfrage nötig):**
16. Fund #2/#4 User-API-Keys + gemeinsame Rechtequelle. *L, mittel.* — größeres Feature, eigene Entscheidung.
17. Fund #22 Dashboard-/Reports-API-Parität. *M, niedrig.*
