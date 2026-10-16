import type { PrismaClient } from "@prisma/client";

/**
 * Test-Cleanup für die Append-only-Tabellen (OrderEvent, AuditLog,
 * StockMovement), deren DB-Trigger UPDATE/DELETE blockieren.
 *
 * `SET LOCAL session_replication_role = replica` überspringt die Trigger nur
 * innerhalb dieser einen Transaktion (= einer DB-Verbindung). Anders als ein
 * globales Abschalten der Trigger per ALTER TABLE entsteht kein global
 * sichtbarer Zustand: parallel laufende Testdateien, die „blocks UPDATE/DELETE" prüfen, sehen die
 * Trigger durchgehend aktiv.
 *
 * Achtung: `replica` schaltet auch die FK-Trigger ab (kein ON DELETE CASCADE,
 * keine FK-Prüfung). Deshalb löscht der Helfer AUSSCHLIESSLICH die
 * Append-only-Zeilen; Order/Artikel/Mandant etc. danach ganz normal löschen.
 *
 * Die Array-Form von `$transaction` führt alle Statements auf einer
 * Verbindung aus — das `SET LOCAL` wirkt damit auf die folgenden deleteMany.
 */
export async function purgeAppendOnly(
  prisma: PrismaClient,
  { tenantIds }: { tenantIds: string[] },
): Promise<void> {
  if (tenantIds.length === 0) return;
  await prisma.$transaction([
    prisma.$executeRawUnsafe("SET LOCAL session_replication_role = replica"),
    prisma.orderEvent.deleteMany({ where: { order: { tenantId: { in: tenantIds } } } }),
    prisma.auditLog.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    prisma.stockMovement.deleteMany({ where: { tenantId: { in: tenantIds } } }),
  ]);
}
