# DocklyLogistics

Logistik- und Rohstoffverwaltung. Multi-Tenant-fähige Next.js-App mit Keycloak-SSO, Prisma+PostgreSQL und Barcode-Scanner (Phase M2+).

## Quickstart

```bash
pnpm install
cp .env.example .env.local
# .env.local mit KEYCLOAK_* und NEXTAUTH_SECRET füllen
docker compose up -d postgres
set -a && source .env.local && set +a
pnpm prisma migrate deploy
pnpm dev
```

App: http://localhost:3000 — Root leitet zu `/dashboard` weiter, das (ohne Session) auf `/login` umlenkt und den Keycloak-SSO-Flow startet.

## Scripts

| Script | Zweck |
|---|---|
| `pnpm dev` | Dev-Server (Turbopack) |
| `pnpm build` | Produktions-Build mit Standalone-Output |
| `pnpm start` | Produktions-Server |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript ohne Emit |
| `pnpm test` | Unit-Tests (Vitest) |
| `pnpm test:watch` | Vitest Watch-Modus |
| `pnpm prisma migrate dev` | Lokale Migration anlegen |
| `pnpm prisma migrate deploy` | Migration ausrollen (CI/Prod) |
| `pnpm prisma generate` | Prisma Client generieren |

## Stack

- **Frontend:** Next.js 15 (App Router) · React 19 · TypeScript 5 · Tailwind v4 · shadcn/ui (radix-nova)
- **Auth:** NextAuth v5 (beta) · Keycloak (BackOfficeDigital)
- **Persistenz:** Prisma 6 · PostgreSQL 16
- **Barcode (M2+):** bwip-js (Server) · @zxing/browser (Client/PWA)
- **Tests:** Vitest (Unit) · Playwright (E2E, M7)
- **Tools:** pnpm 10 · Docker · GitHub Actions

## Rollenmodell

| Rolle | Keycloak-Quelle | Standard |
|---|---|---|
| `GLOBAL_ADMIN` | Realm-Rolle `global_admin` | nein |
| `MANAGER` | Token-Claim `manage_docklylogistics` enthält Tenant | nein |
| `USER` | Token-Claim `internal_user_docklylogistics` enthält Tenant | nein |
| `VIEWER` | Token-Claim `use_docklylogistics` enthält Tenant | **ja** (neue User) |

Siehe `../Docs/KeycloakAuth.md` für das Auth-Konzept und das Freigabe-Workflow.

## Datenbank

Tenant-isoliert via Row-Level (`tenantId`). Pro Deployment ein Tenant via `NEXT_PUBLIC_APP_TENANT`.

Aktuelles Schema (Phase M1): nur `Tenant` und `User`-Modelle. Volles Datenmodell folgt in M2–M6.

## Phasen-Übersicht

| Phase | Inhalt | Status |
|---|---|---|
| M1 | Foundation (Next.js, Auth, DB, Docker, CI) | ✓ |
| M2 | Stammdaten (Artikel, Lieferanten, Lagerplätze, Barcode) | offen |
| M3 | Bestand & Lagermodus (PWA-Scanner) | offen |
| M4 | Bestellungen (Versand via Mail/API/EDI, PDF) | offen |
| M5 | Integration (API-Keys, Webhooks) | offen |
| M6 | Audit & Reports (Hash-Chain, Sealing) | offen |
| M7 | Abnahme (E2E, Last, Security, Deploy) | offen |

## Dokumentation

- **Konzept-PDF:** `../Docs/Konzept_Logistikverwaltung.pdf`
- **Klickdummy (UI-Referenz):** `../Docs/Klickdummy_Logistikverwaltung.html`
- **Detaillierte Umsetzung:** `../Docs/UMSETZUNG.md`
- **Design-Spec:** `../docs/superpowers/specs/2026-05-12-docklylogistics-design.md`
- **Implementierungsplan M1:** `../docs/superpowers/plans/2026-05-12-docklylogistics-m1-foundation.md`

## Lokale Entwicklung

```bash
# Postgres starten (nur dieser Service, ohne app-container)
docker compose up -d postgres

# Schema + Migrationen
docker exec docklylogistics-pg psql -U docklylogistics -d docklylogistics \
  -c "CREATE SCHEMA IF NOT EXISTS docklylogistics;"
set -a && source .env.local && set +a
pnpm prisma migrate deploy

# Dev-Server
pnpm dev
```

## Produktions-Build (Docker)

```bash
docker build -t docklylogistics:latest .
docker compose --profile full up -d
```

## CI

GitHub Actions führt bei jedem Push/PR auf `main`/`develop`:
- pnpm install (frozen lockfile)
- Prisma generate + migrate deploy gegen ephemerale Postgres-Service
- Lint, Typecheck, Unit-Tests, Production-Build
