-- CreateTable
CREATE TABLE "FeatureProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "features" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureProfile_name_key" ON "FeatureProfile"("name");

-- CreateTable
CREATE TABLE "TenantFeature" (
    "tenantId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantFeature_pkey" PRIMARY KEY ("tenantId","featureKey")
);

-- CreateIndex
CREATE INDEX "TenantFeature_tenantId_idx" ON "TenantFeature"("tenantId");

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "featureProfileId" TEXT;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_featureProfileId_fkey" FOREIGN KEY ("featureProfileId") REFERENCES "FeatureProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
