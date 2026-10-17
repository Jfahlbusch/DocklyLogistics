-- Datenmigration Freitext-Zonen -> Zone-Entität (idempotent).
-- Parameter $1: Mandanten-ID oder NULL (= alle Mandanten).
-- Wird 1:1 in die Migration kopiert und vom Integrationstest ausgeführt.
INSERT INTO "Zone" ("id", "tenantId", "name", "sortOrder", "active", "updatedAt")
SELECT 'z' || replace(gen_random_uuid()::text, '-', ''), t."tenantId", t."name", 0, true, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "tenantId", btrim("zone") AS "name"
  FROM "StorageLocation"
  WHERE "zone" IS NOT NULL AND btrim("zone") <> ''
    AND ($1::text IS NULL OR "tenantId" = $1::text)
) t
ON CONFLICT ("tenantId", "name") DO NOTHING;

UPDATE "StorageLocation" sl
SET "zoneId" = z."id"
FROM "Zone" z
WHERE z."tenantId" = sl."tenantId" AND z."name" = btrim(sl."zone")
  AND sl."zone" IS NOT NULL AND btrim(sl."zone") <> ''
  AND sl."zoneId" IS NULL
  AND ($1::text IS NULL OR sl."tenantId" = $1::text);

UPDATE "Article" a
SET "zoneId" = sl."zoneId"
FROM "StorageLocation" sl
WHERE a."defaultLocationId" = sl."id" AND a."tenantId" = sl."tenantId" AND sl."zoneId" IS NOT NULL
  AND a."zoneId" IS NULL
  AND ($1::text IS NULL OR a."tenantId" = $1::text);
