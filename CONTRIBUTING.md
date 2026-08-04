# Mitwirken an DocklyLogistics

Kurzregeln für die Entwicklung. Die maschinenlesbare Variante steht in `CLAUDE.md`, die Struktur in `ARCHITECTURE.md`.

## Setup

Die Entwicklungs-Datenbank liegt — wie bei den anderen Projekten dieser Maschine — als eigene
Datenbank `docklylogistics` auf dem **zentralen lokalen Postgres-Server** (Port 5432). Ein
eigener Datenbank-Container wird für Entwicklung und Tests nicht gebraucht.

```bash
pnpm install
pnpm exec prisma migrate deploy             # Schema in die lokale DB
pnpm dev                                    # http://localhost:3000
```

Einmalig, falls die Datenbank auf einer neuen Maschine noch fehlt:

```bash
psql -h 127.0.0.1 -d postgres -c "CREATE ROLE docklylogistics LOGIN PASSWORD 'docklylogistics';"
psql -h 127.0.0.1 -d postgres -c "CREATE DATABASE docklylogistics OWNER docklylogistics;"
# Test-Cleanup umgeht die Append-only-Trigger — dafür genau dieses eine Recht (kein Superuser):
psql -h 127.0.0.1 -d postgres -c "GRANT SET ON PARAMETER session_replication_role TO docklylogistics;"
```

Umgebungsvariablen: `.env` (lokal). Keycloak-, DB- und Mail-Variablen sind dort dokumentiert.

`docker-compose.yml` beschreibt den **vollständigen Stack** (App + eigene Datenbank) für
produktionsnahe Läufe (`docker compose --profile full up`) — dessen Postgres veröffentlicht
bewusst Port 55432, damit er nie mit dem zentralen Server kollidiert.

## Workflow
1. Branch von `main`. Kleine, fokussierte Commits — **ein Thema pro Commit**. Bugfix und Refactoring nie mischen.
2. Vor dem Commit muss grün sein:
   ```bash
   pnpm exec tsc --noEmit && pnpm lint && pnpm test
   ```
3. Commit-Messages: `typ(scope): kurzbeschreibung` (`feat`, `fix`, `refactor`, `style`, `docs`, `test`). Im Body das *Warum*.
4. PR gegen `main`. Beschreibe Verhalten vorher/nachher; bei UI-Änderungen Screenshot.

## Code-Stil
- TypeScript strict, keine `any`-Schummelei (Cast nur an klar dokumentierten Rändern, z. B. Prisma-`Json`).
- Deutsche Nutzer-Texte mit korrekten Umlauten. Code-Bezeichner englisch.
- Schreibe wie der umgebende Code: gleiche Namensgebung, Kommentardichte, Idiome. Kommentare erklären das *Warum*, nicht das *Was*.
- Zahlen/Datum lokalisiert über `toLocaleString("de-DE", …)`.

## Definition of Done
- [ ] `tsc`, `lint`, `test` grün.
- [ ] Neue Funktion hat ein `/api/v1`-Gegenstück **und** ist in `lib/schemas/*` per `registry.registerPath` dokumentiert (API-Parität).
- [ ] Berechtigung über `requireRoleFromHeaders` geprüft (keine parallele Rechtelogik).
- [ ] Test dazu: Route-Integrationstest und/oder Repo/Service-Unit-Test. DB-Tests räumen ihren Tenant auf.
- [ ] Tenant-Isolation: jede Query filtert `tenantId`.
- [ ] Schema-Änderung? → Prisma-Migration eingecheckt.
- [ ] Kein Secret im Code; keine Verhaltens-/Optik-Änderung ungewollt.

## Review-Kriterien
Korrektheit & Tenant-Isolation zuerst, dann API-Parität, dann Wiederverwendung (wurde ein bestehender Baustein übersehen?), dann Stil. Append-only-Tabellen (`AuditLog`, `OrderEvent`, `StockMovement`) dürfen nie per UPDATE/DELETE angefasst werden.

## Tests, die verlässlich bleiben

Zwei Fehlerbilder haben hier bereits CI-Läufe gekippt, obwohl lokal alles grün war —
beide sind Testfehler, keine Codefehler:

- **Kein globales Zählen.** `prisma.<model>.count()` ohne `where` zählt über alle Mandanten
  und wird damit von parallel laufenden Testdateien verändert. Immer auf den Testmandanten
  einschränken.
- **Keine Zufallsabhängigkeit in Zusicherungen.** Wird ein zufälliger Wert mutiert, um einen
  Fehlerfall zu erzeugen, muss die Mutation ihn garantiert verändern (und das sollte
  mitgeprüft werden) — sonst schlägt der Test in einem Bruchteil der Läufe grundlos fehl.

Dazu: Test-Cleanup läuft **vor und nach** dem Lauf, damit ein Abbruch den nächsten Lauf nicht
blockiert (Unique-Constraints!). Routen, die den Body per `req.text()` lesen, brauchen
`makeRequest(..., { rawBody })` — ein JSON-Body käme escaped an.
