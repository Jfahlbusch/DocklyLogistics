-- AlterTable
ALTER TABLE "TenantEdiSettings" ADD COLUMN "as2Id" TEXT,
ADD COLUMN "as2PrivateKeyEncrypted" TEXT,
ADD COLUMN "as2CertificatePem" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TenantEdiSettings_as2Id_key" ON "TenantEdiSettings"("as2Id");

-- AlterTable
ALTER TABLE "EdiPartnerMailbox" ADD COLUMN "as2Id" TEXT,
ADD COLUMN "as2CertificatePem" TEXT,
ADD COLUMN "as2Url" TEXT;
