/**
 * Backfill hash + prevHash on all AuditLog + OrderEvent rows that currently have empty values.
 * Idempotent: rows that already have a hash are left untouched.
 *
 * Chain logic:
 *   - AuditLog: one chain per tenantId, ordered by (createdAt, id)
 *   - OrderEvent: one chain per orderId, ordered by (createdAt, id)
 *
 * The append-only trigger must be temporarily disabled to allow UPDATE.
 */
import { prisma } from "../lib/db/client";
import { auditLogHash, orderEventHash, GENESIS_PREV_HASH } from "../lib/audit/chain";

async function disableTriggers() {
  await prisma.$executeRawUnsafe('ALTER TABLE "AuditLog" DISABLE TRIGGER auditlog_no_update;');
  await prisma.$executeRawUnsafe('ALTER TABLE "OrderEvent" DISABLE TRIGGER orderevent_no_update;');
}
async function enableTriggers() {
  await prisma.$executeRawUnsafe('ALTER TABLE "AuditLog" ENABLE TRIGGER auditlog_no_update;');
  await prisma.$executeRawUnsafe('ALTER TABLE "OrderEvent" ENABLE TRIGGER orderevent_no_update;');
}

async function backfillAuditLog() {
  const tenants = await prisma.auditLog.findMany({
    where: { OR: [{ hash: "" }, { hash: { equals: "" } }] },
    distinct: ["tenantId"],
    select: { tenantId: true },
  });
  let total = 0;
  for (const { tenantId } of tenants) {
    const rows = await prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    let prev = GENESIS_PREV_HASH;
    let updated = 0;
    for (const r of rows) {
      // If a row already has a non-empty hash, keep it but use its hash as prev for the next.
      if (r.hash && r.hash.length === 64) {
        prev = r.hash;
        continue;
      }
      const h = auditLogHash(
        {
          tenantId: r.tenantId, entity: r.entity, entityId: r.entityId,
          action: r.action, actorId: r.actorId, actorEmail: r.actorEmail,
          before: r.before, after: r.after, createdAt: r.createdAt,
        },
        prev,
      );
      await prisma.auditLog.update({ where: { id: r.id }, data: { hash: h, prevHash: prev } });
      prev = h;
      updated++;
    }
    console.log(`  audit-log tenant=${tenantId}: hashed ${updated}/${rows.length}`);
    total += updated;
  }
  return total;
}

async function backfillOrderEvents() {
  // Get distinct orderIds that have at least one event missing a hash
  const orders = await prisma.orderEvent.findMany({
    where: { hash: "" },
    distinct: ["orderId"],
    select: { orderId: true },
  });
  let total = 0;
  for (const { orderId } of orders) {
    const rows = await prisma.orderEvent.findMany({
      where: { orderId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    let prev = GENESIS_PREV_HASH;
    let updated = 0;
    for (const r of rows) {
      if (r.hash && r.hash.length === 64) { prev = r.hash; continue; }
      const h = orderEventHash(
        {
          orderId: r.orderId, type: r.type, fromStatus: r.fromStatus, toStatus: r.toStatus,
          actorId: r.actorId, payload: r.payload, createdAt: r.createdAt,
        },
        prev,
      );
      await prisma.orderEvent.update({ where: { id: r.id }, data: { hash: h, prevHash: prev } });
      prev = h;
      updated++;
    }
    console.log(`  order-event order=${orderId.slice(0, 8)}: hashed ${updated}/${rows.length}`);
    total += updated;
  }
  return total;
}

async function main() {
  console.log("[backfill] starting…");
  await disableTriggers();
  try {
    const a = await backfillAuditLog();
    const o = await backfillOrderEvents();
    console.log(`[backfill] done. AuditLog: ${a}, OrderEvent: ${o}`);
  } finally {
    await enableTriggers();
  }
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[backfill] failed:", err);
  try { await enableTriggers(); } catch {}
  process.exit(1);
});
