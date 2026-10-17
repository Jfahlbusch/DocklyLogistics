-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "zoneId" TEXT;

-- AlterTable
ALTER TABLE "StorageLocation" ADD COLUMN     "zoneId" TEXT;

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Zone_tenantId_idx" ON "Zone"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_tenantId_name_key" ON "Zone"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Article_zoneId_idx" ON "Article"("zoneId");

-- CreateIndex
CREATE INDEX "StorageLocation_zoneId_idx" ON "StorageLocation"("zoneId");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- DataMigration: Freitext-Zonen -> Zone (identisch zu prisma/sql/migrate-zone-text.sql, $1 = NULL = alle Mandanten)
INSERT INTO "Zone" ("id", "tenantId", "name", "sortOrder", "active", "updatedAt")
SELECT 'z' || replace(gen_random_uuid()::text, '-', ''), t."tenantId", t."name", 0, true, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "tenantId", btrim("zone") AS "name"
  FROM "StorageLocation"
  WHERE "zone" IS NOT NULL AND btrim("zone") <> ''
    AND TRUE
) t
ON CONFLICT ("tenantId", "name") DO NOTHING;

UPDATE "StorageLocation" sl
SET "zoneId" = z."id"
FROM "Zone" z
WHERE z."tenantId" = sl."tenantId" AND z."name" = btrim(sl."zone")
  AND sl."zone" IS NOT NULL AND btrim(sl."zone") <> ''
  AND sl."zoneId" IS NULL
  AND TRUE;

UPDATE "Article" a
SET "zoneId" = sl."zoneId"
FROM "StorageLocation" sl
WHERE a."defaultLocationId" = sl."id" AND a."tenantId" = sl."tenantId" AND sl."zoneId" IS NOT NULL
  AND a."zoneId" IS NULL
  AND TRUE;
