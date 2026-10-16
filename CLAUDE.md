# CLAUDE.md — Arbeitsregeln für DocklyLogistics

Maschinenlesbare Regeln für Claude-Sessions in diesem Repo. **Nutzeranweisungen haben Vorrang.** Halte dich kurz, ändere Verhalten nie ungefragt.

## Stack & Befehle
- Next.js 15 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 (`@theme` in `app/globals.css`) · Prisma + PostgreSQL · NextAuth v5 + Keycloak · pnpm · Vitest.
- Vor jedem Commit grün: `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm test`.
- DB-Tests laufen gegen die Datenbank `docklylogistics` auf dem **zentralen lokalen Postgres** (Port 5432, neben den anderen Projekten dieser Maschine) — **kein** eigener DB-Container. Schema: `pnpm exec prisma migrate deploy`. Ersteinrichtung: siehe `CONTRIBUTING.md` → Setup.
- Deploy: siehe `ARCHITECTURE.md` → „Deploy". Migration **vor** Image-Swap.

## Architektur-Regeln (nicht verletzen)
- **Schichten:** Route (`app/api/v1/**`) → Service (`lib/services`) / Repo (`lib/db/repos`) → Prisma. UI-Seiten (`app/(app)/**`) lesen serverseitig über Repos/Services, Client-Komponenten rufen die API. **Keine Prisma-Aufrufe in Komponenten oder Routen-Handlern selbst** — immer über ein Repo.
- **Tenant-Isolation:** Jede Repo-Query filtert `tenantId`. Nie tenant-übergreifend lesen/schreiben.
- **Auth nur über die eine Quelle:** `requireRoleFromHeaders(headers, minRole)` aus `lib/api/guard.ts`. Sie prüft Session **und** `X-API-Key` (über `lib/api/user-key-auth.ts`). Keine parallele Rechteprüfung bauen. Braucht eine Route zusätzlich die E-Mail des Nutzers (nutzerbezogene Daten, z. B. Lesestatus der Benachrichtigungen): `requireUserFromHeaders` — E-Mail aus `auth()` bzw. dem persönlichen API-Key, normalisiert, nie aus Header/Body. Rollen: `GLOBAL_ADMIN > MANAGER > USER > VIEWER`.
- **Mandanten-Wechsler (GLOBAL_ADMIN):** Der wirksame Mandant entsteht nur über `resolveSessionTenant` (`lib/auth/session-tenant.ts`) und wird an **zwei** Stellen aufgelöst — NextAuth-Session-Callback (`session.tenant`, Seiten) und `middleware.ts` (signierter `x-user-tenant`-Header, API; über `headerSessionFor`). `session.homeTenant` ist immer der echte Mandant, `session.tenant` der wirksame: Rechte/Provisionierung (z. B. `/users/auth/complete`) nutzen `homeTenant`, Daten-Queries `tenant`. Das Cookie `admin_view_tenant` zählt nur für GLOBAL_ADMIN (Rolle immer aus der Sitzung, nie aus dem Cookie), wird nur in `/api/v1/me/tenant-view` gesetzt und endet bei Logout/SSO-Einstieg. Die Session enthält keine `claims`/Tokens.
- **Abmelden beendet die Keycloak-Sitzung:** `logoutAction` liest das `idToken` aus dem JWT-Cookie (`lib/auth/id-token.ts`, nur im JWT, nie in der Session) und leitet auf den Keycloak-`end_session_endpoint` (`lib/auth/keycloak-logout.ts`). Rücksprung-Host nur, wenn er zu `NEXTAUTH_URL`/`NEXT_PUBLIC_APP_URL` passt. Ohne Token (Alt-Sitzung) oder bei Fehler: lokale Abmeldung → `/login`.
- **Audit ist append-only:** `AuditLog`, `OrderEvent`, `StockMovement` haben DB-Trigger gegen UPDATE/DELETE (Hash-Kette). Nie umgehen — außer im Test-Cleanup, und dort ausschließlich über `purgeAppendOnly()` aus `tests/helpers/purge-append-only.ts` (`SET LOCAL session_replication_role = replica` nur in der eigenen Transaktion). Nie `ALTER TABLE … DISABLE TRIGGER` — das schaltet die Trigger global ab und lässt parallele Testdateien flaken.
- **Versand** läuft über `lib/channels` (`dispatchOrder` → EMAIL/API/EDI). Transiente Fehler (5xx/429/Timeout/Netz) via `withRetry` wiederholen, **4xx nie**. API-Versand trägt einen stabilen `Idempotency-Key` (= `order.id`).
- **Secrets nie im Code:** Webhook-Secrets sind AES-verschlüsselt (`lib/crypto`); Deploy-Zugänge liegen in `.deploy-secrets/` (gitignored).

## API-Parität (Pflicht)
Jede UI-Funktion hat ein `/api/v1`-Gegenstück — keine Logik, die nur über die UI erreichbar ist. Neue Route → in `lib/schemas/*` mit `registry.registerPath(...)` dokumentieren (erscheint in `/api-docs`). User verwalten eigene, auf ihre Rolle gescopte API-Keys unter Einstellungen → API-Keys (`/api/v1/me/api-keys`).

## Wiederverwendung („erst suchen, dann bauen")
Vor neuer UI/Logik prüfen, ob es den Baustein schon gibt:
- UI: `components/ui/` — u. a. `StatusPill`, `FormField`, `DetailField`, `FlashBanner`, plus shadcn-Primitives.
- Layout: `components/layout/` — `Brand`, `TenantChip`, `NotificationBell`, Topbar/Sidebar, `TabBar` (mobil).
- **Navigation:** einzige Quelle ist `lib/navigation.ts` (Registry-Modell der Menü-Vorlage: Bereiche Übersicht/Einkauf/Lager/Verwaltung in `NAV_AREAS`, Einträge in `NAV_ENTRIES` mit `labelKey` unter `nav.*` in `messages/de.json`; Sichtbarkeit über den `allowed`-Filter der Feature-Rechte; `tabLabelKey` für die mobile Pill). Sidebar, Drawer, Tab-Pill und ⌘K leiten sich daraus ab (bis zum Menü-Umbau S2 über kompatible Wrapper `navGroups`/`tabItems`/`activeNavId`/`paletteNavEntries`) — nie einen Menüpunkt nur in einer Darstellung anlegen. Max. 4 Tabs + Suche, kein Profil-Tab. Texte: next-intl nur Deutsch ohne URL-Sprache (`i18n/*`, `messages/de.json`); Tests mit `useTranslations` nutzen `renderWithIntl` aus `tests/helpers/intl.tsx`.
- **Profilmenü:** ein Inhalt (`ProfileMenuContent`), zwei Auslöser (Topbar-Avatar, Sidebar-Fuß). Initialen/Rollen nur über `lib/user-display.ts`.
- Quer: `lib/api` (`handler`, `guard`, `respond`), `lib/channels/retry` (`withRetry`), `lib/search`, `lib/utils`.
Ähnlicher, aber zufällig gleicher Code wird **nicht** zwangsvereinheitlicht (siehe die bewusst inline belassenen px-4-Flash-Banner).

## Pflichten bei jeder Änderung
- Neue Route/Repo/Service/Channel → **Test** dazu (`*.test.ts` daneben). DB-Tests räumen ihren Tenant auf.
- Verhalten/Optik nie unbemerkt ändern. Bugfix und Refactoring getrennt committen.
- **Mobil:** Neue Daten-`<table>` braucht eine Karten-Variante — Tabelle `hidden overflow-x-auto md:block`, darunter eine `md:hidden` Karten-Liste, die dieselben Handler/Daten nutzt (Muster: articles-/orders-/suggestions-/api-keys-View). Ausgenommen: schmale Tabellen im responsiven Grid und die Detail-Modals.
- Schema-Änderung → Prisma-Migration; Prod-Deploy fährt `migrate deploy` vor dem Image-Swap.
- Offene Funde/Architekturbewertung stehen in `CODE_REVIEW.md`.
