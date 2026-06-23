-- CreateTable
CREATE TABLE "RoleFeature" (
    "tenantId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "featureKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleFeature_pkey" PRIMARY KEY ("tenantId","role","featureKey")
);

-- CreateIndex
CREATE INDEX "RoleFeature_tenantId_role_idx" ON "RoleFeature"("tenantId", "role");

-- CreateTable
CREATE TABLE "UserFeatureOverride" (
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFeatureOverride_pkey" PRIMARY KEY ("tenantId","userId","featureKey")
);

-- CreateIndex
CREATE INDEX "UserFeatureOverride_tenantId_userId_idx" ON "UserFeatureOverride"("tenantId", "userId");
