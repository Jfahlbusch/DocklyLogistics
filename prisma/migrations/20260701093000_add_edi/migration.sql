-- CreateTable
CREATE TABLE "TenantEdiSettings" (
    "tenantId" TEXT NOT NULL,
    "inboundToken" TEXT NOT NULL,
    "inboundActive" BOOLEAN NOT NULL DEFAULT true,
    "autoConfirm" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantEdiSettings_pkey" PRIMARY KEY ("tenantId")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantEdiSettings_inboundToken_key" ON "TenantEdiSettings"("inboundToken");

-- CreateTable
CREATE TABLE "EdiMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "transport" TEXT,
    "supplierId" TEXT,
    "orderId" TEXT,
    "interchangeRef" TEXT,
    "documentNo" TEXT,
    "payload" TEXT NOT NULL,
    "parsed" JSONB,
    "error" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EdiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EdiMessage_tenantId_createdAt_idx" ON "EdiMessage"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "EdiMessage_tenantId_direction_status_idx" ON "EdiMessage"("tenantId", "direction", "status");

-- CreateIndex
CREATE INDEX "EdiMessage_tenantId_orderId_idx" ON "EdiMessage"("tenantId", "orderId");
