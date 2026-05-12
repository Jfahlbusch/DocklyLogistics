-- CreateTable
CREATE TABLE "AuditSeal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sealDate" TEXT NOT NULL,
    "rootHash" TEXT NOT NULL,
    "entryCount" INTEGER NOT NULL,
    "sealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditSeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditSeal_tenantId_sealDate_idx" ON "AuditSeal"("tenantId", "sealDate");

-- CreateIndex
CREATE UNIQUE INDEX "AuditSeal_tenantId_sealDate_key" ON "AuditSeal"("tenantId", "sealDate");

-- Append-only protection for AuditLog (mirrors OrderEvent + StockMovement; hash chain comes via lib/audit/chain.ts)
DROP TRIGGER IF EXISTS auditlog_no_update ON "AuditLog";
CREATE TRIGGER auditlog_no_update BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_mutation();
