-- CreateTable
CREATE TABLE "UserApiKey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "label" TEXT,
    "prefix" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserApiKey_prefix_key" ON "UserApiKey"("prefix");

-- CreateIndex
CREATE INDEX "UserApiKey_tenantId_userId_idx" ON "UserApiKey"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "UserApiKey_prefix_idx" ON "UserApiKey"("prefix");

