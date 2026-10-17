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
- Layout: `components/layout/` — Menü nach `seitenmenue.md` (Vorlagen aus dem ini-projekt-Skill, `assets/layout/`): `Sidebar` (schwebend, Cookie `ui_sidebar`), `NavLinks` (Bereiche, Cookie `ui_nav_areas`, alle standardmäßig offen; jeder Bereich öffnet sich direkt im Menü, bei Platzmangel scrollt die Bereichsliste — keine Platz-Popover; Popover nur für zugeklappte Bereiche der eingeklappten Leiste), `TenantSwitcher`/`tenant-card` (Unternehmenskarte), `SidebarUser` (Profilzeile), `MobileNav` (Drawer < 992 px), `TabBar`, `Topbar`, `NotificationBell`. Breakpoint `nav:` (992 px), nicht `lg`. Seiten scrollen im Dokument (kein innerer Scrollbereich).
- **Navigation:** einzige Quelle ist `lib/navigation.ts` (Registry-Modell der Menü-Vorlage: Bereiche Übersicht/Einkauf/Lager/Verwaltung in `NAV_AREAS`, Einträge in `NAV_ENTRIES` mit `labelKey` unter `nav.*` in `messages/de.json`; Sichtbarkeit über den `allowed`-Filter der Feature-Rechte). Sidebar, Drawer, Tab-Pill und ⌘K leiten sich daraus ab — nie einen Menüpunkt nur in einer Darstellung anlegen. Tab-Leiste: ein Tab je Bereich + Suche, kein Profil-Tab. Texte: next-intl nur Deutsch ohne URL-Sprache (`i18n/*`, `messages/de.json`); Tests mit `useTranslations` nutzen `renderWithIntl` aus `tests/helpers/intl.tsx`.
- **Profil:** nur die Profilzeile am Menüfuß (`SidebarUser`: Farbschema · Benutzermenü · Abmelden über `logoutAction` in `profile-actions.ts`, vorher `clearServiceWorkerCaches`). Kein Avatar in der Kopfleiste; unter 992 px sitzt das Farbschema in der Kopfleiste (`ThemeMenuButton`). Rollennamen über `shell.user.roles.*`.
- Quer: `lib/api` (`handler`, `guard`, `respond`), `lib/channels/retry` (`withRetry`), `lib/search`, `lib/utils`.
Ähnlicher, aber zufällig gleicher Code wird **nicht** zwangsvereinheitlicht (siehe die bewusst inline belassenen px-4-Flash-Banner).

## Pflichten bei jeder Änderung
- Neue Route/Repo/Service/Channel → **Test** dazu (`*.test.ts` daneben). DB-Tests räumen ihren Tenant auf.
- Verhalten/Optik nie unbemerkt ändern. Bugfix und Refactoring getrennt committen.
- **Mobil & Tablet (Regeltest `tests/unit/mobile-rules.test.ts`):** Dialoge nur über `ResponsiveDialog` (`components/ui/responsive-dialog.tsx`: ab `md` Dialog, darunter Bottom-Sheet; nie `@/components/ui/dialog` direkt, keine eigenen `fixed inset-0`-Overlays). Native `select`/`textarea` nur mit den Klassen aus `components/ui/native-field.ts` (16 px mobil, kein iOS-Zoom); an `<Input>` nie nacktes `text-sm` (→ `md:text-sm`). Checkboxen/Chips: `CHECKBOX_CLASS`, `CHECK_LABEL_CLASS`, `CHIP_CLASS`. Breite Tabellen (passen nicht in ~660 px) zeigen Karten bis `xl` (`hidden xl:block` / `xl:hidden`); ab `xl` passen sie ohne internes Scrollen, sonst Nebenspalten `hidden 2xl:table-cell`. Passende `inputMode`/`type`/`autoCapitalize` setzen. Prüfgrößen: 375 × 812, 768 × 1024, 1024 × 768.
- **Mobil:** Neue Daten-`<table>` braucht eine Karten-Variante — Tabelle `hidden overflow-x-auto md:block`, darunter eine `md:hidden` Karten-Liste, die dieselben Handler/Daten nutzt (Muster: articles-/orders-/suggestions-/api-keys-View). Ausgenommen: schmale Tabellen im responsiven Grid und die Detail-Modals.
- Schema-Änderung → Prisma-Migration; Prod-Deploy fährt `migrate deploy` vor dem Image-Swap.
- Offene Funde/Architekturbewertung stehen in `CODE_REVIEW.md`.
