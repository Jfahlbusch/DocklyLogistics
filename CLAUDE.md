# CLAUDE.md — Arbeitsregeln für DocklyLogistics

Maschinenlesbare Regeln für Claude-Sessions in diesem Repo. **Nutzeranweisungen haben Vorrang.** Halte dich kurz, ändere Verhalten nie ungefragt.

## Stack & Befehle
- Next.js 15 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 (`@theme` in `app/globals.css`) · Prisma + PostgreSQL · NextAuth v5 + Keycloak · pnpm · Vitest.
- Vor jedem Commit grün: `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm test`.
- DB-Tests brauchen Postgres: `docker start docklylogistics-pg`. Schema lokal: `pnpm exec prisma db push`.
- Deploy: siehe `ARCHITECTURE.md` → „Deploy". Migration **vor** Image-Swap.

## Architektur-Regeln (nicht verletzen)
- **Schichten:** Route (`app/api/v1/**`) → Service (`lib/services`) / Repo (`lib/db/repos`) → Prisma. UI-Seiten (`app/(app)/**`) lesen serverseitig über Repos/Services, Client-Komponenten rufen die API. **Keine Prisma-Aufrufe in Komponenten oder Routen-Handlern selbst** — immer über ein Repo.
- **Tenant-Isolation:** Jede Repo-Query filtert `tenantId`. Nie tenant-übergreifend lesen/schreiben.
- **Auth nur über die eine Quelle:** `requireRoleFromHeaders(headers, minRole)` aus `lib/api/guard.ts`. Sie prüft Session **und** `X-API-Key` (über `lib/api/user-key-auth.ts`). Keine parallele Rechteprüfung bauen. Rollen: `GLOBAL_ADMIN > MANAGER > USER > VIEWER`.
- **Audit ist append-only:** `AuditLog`, `OrderEvent`, `StockMovement` haben DB-Trigger gegen UPDATE/DELETE (Hash-Kette). Nie umgehen — außer transient im Test-Cleanup (`ALTER TABLE … DISABLE TRIGGER …`, im `finally` wieder ENABLE).
- **Versand** läuft über `lib/channels` (`dispatchOrder` → EMAIL/API/EDI). Transiente Fehler (5xx/429/Timeout/Netz) via `withRetry` wiederholen, **4xx nie**. API-Versand trägt einen stabilen `Idempotency-Key` (= `order.id`).
- **Secrets nie im Code:** Webhook-Secrets sind AES-verschlüsselt (`lib/crypto`); Deploy-Zugänge liegen in `.deploy-secrets/` (gitignored).

## API-Parität (Pflicht)
Jede UI-Funktion hat ein `/api/v1`-Gegenstück — keine Logik, die nur über die UI erreichbar ist. Neue Route → in `lib/schemas/*` mit `registry.registerPath(...)` dokumentieren (erscheint in `/api-docs`). User verwalten eigene, auf ihre Rolle gescopte API-Keys unter Einstellungen → API-Keys (`/api/v1/me/api-keys`).

## Wiederverwendung („erst suchen, dann bauen")
Vor neuer UI/Logik prüfen, ob es den Baustein schon gibt:
- UI: `components/ui/` — u. a. `StatusPill`, `FormField`, `DetailField`, `FlashBanner`, plus shadcn-Primitives.
- Layout: `components/layout/` — `Logo`, `NotificationBell`, Topbar/Sidebar.
- Quer: `lib/api` (`handler`, `guard`, `respond`), `lib/channels/retry` (`withRetry`), `lib/search`, `lib/utils`.
Ähnlicher, aber zufällig gleicher Code wird **nicht** zwangsvereinheitlicht (siehe die bewusst inline belassenen px-4-Flash-Banner).

## Pflichten bei jeder Änderung
- Neue Route/Repo/Service/Channel → **Test** dazu (`*.test.ts` daneben). DB-Tests räumen ihren Tenant auf.
- Verhalten/Optik nie unbemerkt ändern. Bugfix und Refactoring getrennt committen.
- Schema-Änderung → Prisma-Migration; Prod-Deploy fährt `migrate deploy` vor dem Image-Swap.
- Offene Funde/Architekturbewertung stehen in `CODE_REVIEW.md`.
