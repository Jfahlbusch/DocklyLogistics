-- Lesestatus je Nutzer. Notification.readAt bleibt als Altbestand (mandantenweit
-- gelesen) bestehen, wird aber nicht mehr gesetzt.

-- CreateTable
CREATE TABLE "NotificationRead" (
    "notificationId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRead_pkey" PRIMARY KEY ("notificationId","userEmail")
);

-- CreateIndex
CREATE INDEX "NotificationRead_tenantId_userEmail_idx" ON "NotificationRead"("tenantId", "userEmail");

-- AddForeignKey
ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
