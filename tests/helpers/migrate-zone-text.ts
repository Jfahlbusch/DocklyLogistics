import fs from "node:fs";
import path from "node:path";
import type { Prisma } from "@prisma/client";

const SQL_FILE = path.resolve(__dirname, "../../prisma/sql/migrate-zone-text.sql");

/** Der SQL-Teil der Datenmigration aus `20261017110000_zones` (Quelle: prisma/sql/migrate-zone-text.sql). */
export function zoneTextMigrationSql(): string {
  return fs.readFileSync(SQL_FILE, "utf8");
}

/** Führt die Datenmigration aus; `tenantId` begrenzt sie auf einen Mandanten (null = alle). */
export async function migrateZoneTexts(tx: Prisma.TransactionClient, tenantId: string | null = null) {
  const statements = zoneTextMigrationSql()
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.replace(/--.*$/gm, "").trim().length > 0);
  for (const stmt of statements) await tx.$executeRawUnsafe(stmt, tenantId);
}
