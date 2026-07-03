-- CreateTable
CREATE TABLE "TenantSftpSettings" (
    "tenantId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 22,
    "username" TEXT NOT NULL,
    "authType" TEXT NOT NULL,
    "privateKeyEncrypted" TEXT,
    "passwordEncrypted" TEXT,
    "hostKeyFingerprint" TEXT,
    "outboxDir" TEXT NOT NULL DEFAULT '/outbox',
    "inboxDir" TEXT NOT NULL DEFAULT '/inbox',
    "inboxFormat" TEXT NOT NULL DEFAULT 'XML',
    "routing" TEXT NOT NULL DEFAULT 'FILE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "autoSend" BOOLEAN NOT NULL DEFAULT true,
    "lastPolledAt" TIMESTAMP(3),
    "lastPollError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSftpSettings_pkey" PRIMARY KEY ("tenantId")
);
