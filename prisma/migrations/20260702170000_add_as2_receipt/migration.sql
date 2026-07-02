-- CreateTable
CREATE TABLE "As2InboundReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "As2InboundReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "As2InboundReceipt_tenantId_messageId_key" ON "As2InboundReceipt"("tenantId", "messageId");

-- CreateIndex
CREATE INDEX "As2InboundReceipt_tenantId_idx" ON "As2InboundReceipt"("tenantId");
