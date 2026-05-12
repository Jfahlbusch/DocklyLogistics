-- CreateEnum
CREATE TYPE "SupplierChannel" AS ENUM ('EMAIL', 'API', 'EDI');

-- CreateEnum
CREATE TYPE "BarcodeSource" AS ENUM ('SKU', 'EAN');

-- CreateEnum
CREATE TYPE "UnitKind" AS ENUM ('PIECE', 'KG', 'G', 'L', 'ML', 'PACK', 'SACK', 'BOX', 'PALLET', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'SEND', 'CANCEL', 'RECEIVE', 'LOGIN', 'EXPORT');

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortDesc" TEXT,
    "longDesc" TEXT,
    "category" TEXT,
    "eanGtin" TEXT,
    "baseUnit" "UnitKind" NOT NULL,
    "orderUnit" "UnitKind" NOT NULL,
    "packFactor" INTEGER NOT NULL,
    "barcodeSource" "BarcodeSource" NOT NULL DEFAULT 'SKU',
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "defaultLocationId" TEXT,
    "vatRate" DECIMAL(5,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "street" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "channel" "SupplierChannel" NOT NULL DEFAULT 'EMAIL',
    "channelConfig" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleSupplier" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchasePrice" DECIMAL(12,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 3,
    "minOrderQty" INTEGER NOT NULL DEFAULT 1,
    "supplierSku" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageLocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zone" TEXT,
    "bin" TEXT,
    "capacity" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantChannelConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" "SupplierChannel" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantChannelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "before" JSONB,
    "after" JSONB,
    "hash" TEXT NOT NULL DEFAULT '',
    "prevHash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Article_tenantId_idx" ON "Article"("tenantId");

-- CreateIndex
CREATE INDEX "Article_tenantId_eanGtin_idx" ON "Article"("tenantId", "eanGtin");

-- CreateIndex
CREATE UNIQUE INDEX "Article_tenantId_sku_key" ON "Article"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "Supplier_tenantId_idx" ON "Supplier"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_tenantId_name_key" ON "Supplier"("tenantId", "name");

-- CreateIndex
CREATE INDEX "ArticleSupplier_supplierId_idx" ON "ArticleSupplier"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleSupplier_articleId_supplierId_key" ON "ArticleSupplier"("articleId", "supplierId");

-- CreateIndex
CREATE INDEX "StorageLocation_tenantId_idx" ON "StorageLocation"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "StorageLocation_tenantId_code_key" ON "StorageLocation"("tenantId", "code");

-- CreateIndex
CREATE INDEX "TenantChannelConfig_tenantId_channel_idx" ON "TenantChannelConfig"("tenantId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "TenantChannelConfig_tenantId_channel_label_key" ON "TenantChannelConfig"("tenantId", "channel", "label");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_entity_entityId_idx" ON "AuditLog"("tenantId", "entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_defaultLocationId_fkey" FOREIGN KEY ("defaultLocationId") REFERENCES "StorageLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleSupplier" ADD CONSTRAINT "ArticleSupplier_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleSupplier" ADD CONSTRAINT "ArticleSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial-unique-index: at most one isPrimary=true per articleId in ArticleSupplier
CREATE UNIQUE INDEX "ArticleSupplier_articleId_primary_unique"
  ON "ArticleSupplier" ("articleId")
  WHERE "isPrimary" = true;

-- Partial-unique-index: at most one isDefault=true per (tenantId, channel) in TenantChannelConfig
CREATE UNIQUE INDEX "TenantChannelConfig_tenant_channel_default_unique"
  ON "TenantChannelConfig" ("tenantId", "channel")
  WHERE "isDefault" = true;
