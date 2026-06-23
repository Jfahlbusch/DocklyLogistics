# Architektur — DocklyLogistics

Mandantenfähige Logistik-/Bestell-App (Lager, Artikel, Lieferanten, Bestellungen, Bestellvorschläge) für die Lebensmittel-/Backbranche. Next.js 15 App Router + Prisma/PostgreSQL, Auth über Keycloak (NextAuth v5).

## Schichten und Abhängigkeitsrichtung

```
app/(app)/**         UI-Seiten (Server Components lesen über Repos/Services;
   │                 Client Components rufen die API über fetch)
app/api/v1/**        REST-API  →  handler() + requireRoleFromHeaders() + Zod-Schema
   │
lib/services/**      Geschäftslogik / Orchestrierung (Transaktionen, mehrere Repos)
   │
lib/db/repos/**      Datenzugriff (Prisma), strikt tenant-gescoped
   │
prisma/ (PostgreSQL)
```

**Regeln:**
- Abhängigkeiten zeigen nur nach unten. Eine untere Schicht importiert nie eine obere.
- **Kein Prisma außerhalb von `lib/db/repos`** (Ausnahme: Service-Transaktionen reichen den `tx`-Client an Repo-Funktionen). Routen und Komponenten sprechen nie direkt mit Prisma.
- Querschnitt (`lib/api`, `lib/auth`, `lib/audit`, `lib/crypto`, `lib/channels`, `lib/search`, `lib/utils`) darf von Services/Routen genutzt werden, hängt aber nicht von ihnen ab.

## Verzeichnis-Landkarte
| Pfad | Inhalt |
|---|---|
| `app/(app)/**` | Eingeloggte UI je Domäne (articles, stock, suppliers, orders, order-suggestions, dashboard, reports, audit, settings, warehouse-mode) |
| `app/api/v1/**` | REST-API (56 Routen), versioniert |
| `app/api-docs`, `app/api/v1/openapi.json` | Scalar-Doku aus den `registry.registerPath`-Registrierungen |
| `app/(auth)`, `app/users/auth` | Login + Keycloak-SSO (`/users/auth/sso?origin={tenant}` legt Tenant bei Bedarf an) |
| `lib/db/repos` | 1 Repo je Aggregat (article, supplier, order, stock, webhook, notification, user-api-key, …) |
| `lib/services` | order-service, suggestion-engine, inventory, webhook-worker, … |
| `lib/schemas` | Zod-Validierung **und** OpenAPI-Registrierung je Domäne |
| `lib/channels` | Versand: `dispatchOrder` → email/api/edi, plus `retry`, `scaleway-mail` |
| `lib/api` | `handler`, `guard` (`requireRoleFromHeaders`), `respond`, `openapi`, `user-key-auth` |
| `lib/audit` | Append-only Hash-Kette (`appendAudit`) |
| `lib/auth`, `lib/crypto`, `lib/pdf`, `lib/barcode`, `lib/search` | NextAuth/Keycloak · AES für Webhook-Secrets · PDF-Bestellschein · Barcodes · globale Suche |
| `components/ui` | Wiederverwendbare Primitives: `StatusPill`, `FormField`, `DetailField`, `FlashBanner` + shadcn |
| `components/layout` | `Logo`, `NotificationBell`, Topbar/Sidebar/Brand/Profile |
| `prisma`, `tests`, `scripts` | Schema + Migrationen · Integrationstests · Hilfsskripte |

## Wo gehört Neues hin? — Rezept „neue Funktion"
1. **Schema/Migration** (falls Datenmodell): `prisma/schema.prisma` → `prisma migrate dev` (lokal `db push`).
2. **Repo** in `lib/db/repos/<aggregat>.ts` — tenant-gescopte Queries. Test daneben.
3. **Service** in `lib/services/` nur wenn Orchestrierung/Transaktion nötig.
4. **Zod-Schema + OpenAPI** in `lib/schemas/<domäne>.ts` (`registry.registerPath`).
5. **API-Route** in `app/api/v1/**/route.ts`: `handler(async (req) => { const ctx = await requireRoleFromHeaders(req.headers, "<minRole>"); … })`. Audit-pflichtige Schreibvorgänge über `appendAudit`.
6. **UI** in `app/(app)/<domäne>/` — Server Component lädt über Repo/Service, Client Component ruft die API. Bausteine aus `components/ui` wiederverwenden.
7. **Test** für Route und/oder Repo/Service.

**Erst suchen, dann bauen:** Vor neuer UI/Logik in `components/ui`, `components/layout` und `lib/*` nach einem bestehenden Baustein schauen (z. B. `withRetry`, `StatusPill`, `requireRoleFromHeaders`).

## Querschnitts-Prinzipien
- **API-Parität:** Jede UI-Funktion hat ein API-Gegenstück; beide prüfen Rechte über dieselbe Quelle (`requireRoleFromHeaders`). User-API-Keys (`/api/v1/me/api-keys`) sind auf die Rolle des Users gescoped.
- **Tenant:** aus dem SSO-Origin (Cookie/Token), in jeder Query als `tenantId`-Filter.
- **Audit:** `AuditLog`/`OrderEvent`/`StockMovement` sind per DB-Trigger unveränderlich (Hash-Kette).
- **Versand-Reliability:** transiente Fehler via `withRetry`; API-Versand mit stabilem `Idempotency-Key` (= `order.id`).

## Deploy (logistics.dockly.de)
Scaleway-VM `51.15.219.21`, Docker Compose + Caddy (Auto-TLS).
1. `docker buildx build --platform linux/amd64 -t docklylogistics:dev --load .` → `docker save`.
2. **Migration zuerst** (falls pending): `prisma migrate deploy` gegen die Prod-DB über den öffentlichen Admin-Endpunkt (Zugang in `.deploy-secrets/logistics-dev.env`).
3. `scp` der Image-tar → `docker load` + `docker compose up -d --force-recreate app`.
4. Verify: `https://logistics.dockly.de/login` == 200.

Mailversand läuft über **Scaleway Transactional Email** (Fallback SMTP → lokaler Mock); die TEM-Resource (Domain + Secret) wird separat angelegt.
