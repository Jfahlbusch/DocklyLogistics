# Code-Review: DocklyLogistics — 2026-06-23 (Fokus: Test-Abdeckung & Struktur)

## Zusammenfassung

Die Codebasis ist in gutem Zustand: saubere Schichtung (Route → Service → Repo → Prisma),
durchgängige Zod-Validierung, Channel-Abstraktion, Audit-Hash-Chain. Die in der ersten
Review (2026‑05) kritischen Funde sind inzwischen **behoben** (User-API-Keys, Order-Versand-
Idempotenz, Order-Nummer-Race, Article-Supplier-Tenant-Scoping, Dashboard/Reports-API-Parität).
Die **reine Logik-Schicht ist gut getestet** (130 Tests, DB-gestützt): Services, Repos, Crypto,
Audit, Auth, Channels-Helfer. Die **zwei größten verbleibenden Hebel** sind: (1) **53 Route-
Handler ohne einen einzigen Test** — die vitest-`include` erfasst `app/` nicht, Route-Logik
(Auth, Validierung, Orchestrierung, Idempotenz) ist also komplett ungeprüft; (2) **UI-
Duplikation** (STATUS_STYLES 5×, Field 8×, Kpi 4×, Flash 4×) und vier 500–700-LOC-Komponenten.
Keine Coverage-Messung, keine CI.

## Funde

| # | Kategorie | Schwere | Fundort | Beschreibung | Empfehlung |
|---|-----------|---------|---------|--------------|------------|
| T1 | Tests | **Hoch** | `app/api/**/route.ts` (53 Dateien, 0 Tests) | Kein einziger Route-/Integrationstest. Auth-Guard, Validierung, Status-Maschinen, **Idempotenz (Order-Send)**, **API-Key-Pfad**, Tenant-Scoping nur manuell verifiziert. `vitest.config` `include` listet nur `lib/**` + `tests/unit/**` — Tests in `app/` würden gar nicht laufen. | Integrationstests für die kritischen Routen (Order send/approve/receive, me/api-keys, search, articles CRUD). Request mit Headern bauen, exportiertes `GET/POST` aufrufen. `include` um `tests/integration/**` erweitern. |
| T2 | Tests | **Hoch** | `lib/channels/email.ts:1` (193 LOC) | Die Versand-Kaskade `dispatchEmail`/`sendTestEmail` (TEM→SMTP→Mock, Empfänger-/Absender-Validierung, Fehlerpfade) ist ungetestet. Nur der TEM-Client + Retry-Helfer haben Tests. | Test mit gemocktem Provider: TEM gesetzt → TEM-Pfad; nur SMTP → SMTP; nichts → Mock; fehlende `to`/`fromEmail` → ok:false. |
| T3 | Tests | Mittel | `lib/channels/api.ts:1`, `lib/channels/edi.ts:1` | API- und EDI-Versand ungetestet (HTTP-POST-Aufbau, EDIFACT-String-Bau, Mock-Fallback). | Je ein Test: Payload/EDIFACT-Aufbau + Fehlerfall. |
| T4 | Tests | Mittel | `lib/services/webhook-worker.ts:1` (83 LOC) | Worker (Backoff-Berechnung, Give-up nach 8 Versuchen, decrypt-fail → sofort Give-up) ungetestet — zuverlässigkeitskritisch. | Test mit gemocktem `fetch` + `deliveryRepo`: Erfolg, transienter Fehler→retry-later, 8. Fehler→given-up. |
| T5 | Tests | Mittel | `lib/services/dashboard.ts:1`, `lib/services/webhook-emit.ts:1` | Neue/zentrale Services ohne Test. Dashboard-KPIs (belowMin-Filter, 24h-Webhook-Fehler) und `emitEvent` (Fan-out an aktive Webhooks). | DB-gestützte Tests analog zu `reports.test.ts`. |
| T6 | Tests | Niedrig | `lib/services/order-number.ts:1` | Nummerierung ist über `order-service.test.ts` indirekt abgedeckt (Happy-Path), aber der **Advisory-Lock** (Concurrency) hat keinen direkten Test. | Mind. ein direkter Test der Format-/Increment-Logik; Concurrency optional. |
| T7 | Tests | Niedrig | `lib/db/repos/order.ts`, `lib/db/repos/order-suggestion.ts`, `lib/db/repos/api-key.ts` | Keine direkten Repo-Tests (Order via Service, Supplier-Key via `public-auth.test`). | Schlanke `list`-Filter-Tests ergänzen. |
| T8 | Tests | Niedrig | `vitest.config.ts`, `package.json` | Keine Coverage-Tooling/-Schwelle, keine CI. Abdeckung nicht messbar, Regressionen nicht automatisch geblockt. | `@vitest/coverage-v8` + `test:coverage`-Script; optional CI-Gate. |
| S1 | Struktur | **Hoch** | `STATUS_STYLES`/`CHANNEL_STYLES` in 5 Dateien (`orders-view.tsx`, `suppliers-view.tsx`, `webhooks-tab.tsx`, …) | Status-/Kanal-Farbmaps mehrfach leicht abweichend kopiert. Aus demselben Grund (neuer Status/Kanal) zu ändern → zentrale Quelle fehlt. | `components/ui/status-pill.tsx` + zentrale Label/Style-Map. |
| S2 | Struktur | Mittel | `function Field` in 8 Dateien, `function Kpi` in 4 | Identische Detail-Feld-/KPI-Helfer in jeder View neu definiert (Code-Review #5/#6, weiterhin offen). | `components/ui/field.tsx` + `components/ui/kpi.tsx`. |
| S3 | Struktur | Mittel | Flash-/Toast-State in 4 Views (`setFlash`) | Erfolg/Fehler-Banner handgebaut pro View. | `useFlash()`-Hook + `<FlashBanner>`. |
| S4 | Struktur | Mittel | `article-detail-modal.tsx` (709), `warehouse-mode-view.tsx` (703), `supplier-detail-modal.tsx` (577), `webhooks-tab.tsx` (538) | Vier 500–700-LOC-Komponenten mischen Daten-Fetch, Formularzustand, Sub-Dialoge, Rendering. Schwer testbar/wartbar. | In Unterkomponenten/Hooks aufteilen (Tabs, Sub-Dialoge, Daten-Hooks). |
| S5 | Struktur/Doku | Niedrig | `lib/schemas/*` + `app/api/v1/me/api-keys` | Neue interne Routen (me/api-keys, search, dashboard) sind nicht in der OpenAPI-Spec registriert → Scalar-Doku unvollständig (API-Parität im Code da, in der Doku nicht). | `registerPath` für die neuen Routen ergänzen. |
| G1 | Gut | — | `lib/api/guard.ts`, `lib/db/repos/*` | **Lobenswert:** Auth-Guard vereint Session + API-Key über **eine** Rechtequelle (`hasMinRole`), keine parallelen Rechte-Systeme. Repos durchgängig tenant-gescoped. DB-gestützte Tests mit Cleanup. Audit-Hash-Chain getestet. |

## Strukturbewertung

**Ist-Struktur (sauber, beibehalten):**
```
app/(app)/*        UI-Views + Page-Server-Components (laden via Service/Repo)
app/api/v1/*       Route-Handler  → requireRoleFromHeaders → Service/Repo
lib/api/*          Querschnitt: guard (Session|Key), handler, respond, pagination
lib/services/*     Geschäftslogik (order, reports, dashboard, suggestion, webhook)
lib/db/repos/*     Datenzugriff, tenant-gescoped
lib/channels/*     Versand-Abstraktion (email|api|edi) hinter dispatchOrder
lib/{audit,crypto,auth,schemas,pdf,barcode}
```
Die Schichtung wird konsequent eingehalten (Routen rufen nicht direkt `prisma`, sondern Repos/
Services). Das ist die **Soll-Struktur** — kein Umbau nötig. Die Schulden liegen **nicht** in der
Schichtung, sondern in **(a) fehlenden wiederverwendbaren UI-Bausteinen** (S1–S3) und **(b) zu
großen View-Komponenten** (S4). Beides ist Block-B-Refactoring aus der ersten Review, das bei den
Feature-Sprints nicht mitlief.

## Test- und Doku-Lücken

- **Routen: 0/53 getestet** (T1) — größte Lücke. Kritische, kürzlich gebaute Logik (Order-Send-
  Idempotenz, API-Key-Guard, Tenant-Scoping) ist nur manuell/Prod-verifiziert.
- **Channels:** `email.ts`/`api.ts`/`edi.ts` Dispatch ungetestet (T2/T3).
- **Services:** `webhook-worker`, `dashboard`, `webhook-emit`, `order-number`(direkt) ungetestet (T4–T6).
- **Coverage/CI:** keine Messung, kein Gate (T8).
- **Doku:** neue Routen nicht in OpenAPI (S5). `CLAUDE.md`/`CONTRIBUTING.md`/`ARCHITECTURE.md`
  existieren noch nicht (Skill-Phase 5 offen).

## Empfohlene Maßnahmen (priorisiert)

1. **T1 — Integrationstests für die kritischen Routen** · M · Risiko niedrig. Start: Order
   send (Idempotenz!), me/api-keys (Create→401-mit-falschem-Key), search, articles POST.
   `tests/integration/**` + `include` erweitern.
2. **T2 — `dispatchEmail`/`sendTestEmail` testen** (Provider-Kaskade + Fehlerpfade) · S · niedrig.
3. **T4 — `webhook-worker` testen** (Backoff, Give-up, decrypt-fail) · S–M · niedrig.
4. **T8 — Coverage-Tooling** (`@vitest/coverage-v8` + Script) · S · niedrig — macht die Lücken messbar.
5. **S1–S3 — Wiederverwendbare UI-Bausteine** (StatusPill, Field, Kpi, FlashBanner) · M · **mittel**
   (UI-Verhalten; pro Schritt visuell prüfen). Entfernt 5×/8×/4×-Duplikation.
6. **T3/T5/T6/T7 — restliche Logik-Tests** · S je · niedrig.
7. **S4 — Große Komponenten splitten** · L · mittel. Erst nach S1–S3 (die Bausteine helfen beim Splitten).
8. **S5 + Phase 5 — OpenAPI für neue Routen + CLAUDE/CONTRIBUTING/ARCHITECTURE** · S–M · niedrig.

> Default-Vorschlag (Schwere Hoch + Risiko niedrig): **T1, T2, T4, T8** zuerst — schließt die
> gefährlichste Lücke (ungetestete Routen-/Versand-/Worker-Logik) ohne Verhaltensänderung.
