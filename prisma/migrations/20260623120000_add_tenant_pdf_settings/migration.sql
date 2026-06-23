-- CreateTable
CREATE TABLE "TenantPdfSettings" (
    "tenantId" TEXT NOT NULL,
    "logoDataUri" TEXT,
    "headerText" TEXT,
    "footerText" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantPdfSettings_pkey" PRIMARY KEY ("tenantId")
);
