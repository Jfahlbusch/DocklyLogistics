-- CreateTable
CREATE TABLE "EdiPartnerMailbox" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partnerGln" TEXT,
    "supplierId" TEXT,
    "token" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EdiPartnerMailbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EdiPartnerMailbox_token_key" ON "EdiPartnerMailbox"("token");

-- CreateIndex
CREATE UNIQUE INDEX "EdiPartnerMailbox_tenantId_name_key" ON "EdiPartnerMailbox"("tenantId", "name");

-- CreateIndex
CREATE INDEX "EdiPartnerMailbox_tenantId_idx" ON "EdiPartnerMailbox"("tenantId");
