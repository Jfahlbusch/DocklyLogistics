-- Bestellnummern werden pro Mandant vergeben (nextOrderNo zählt je tenantId +
-- Jahr). Der bisherige globale Unique-Index hätte den zweiten Mandanten bei
-- seiner ersten Bestellung des Jahres blockiert (ORD-JJJJ-0001 doppelt).
-- Datenverlustfrei: es werden nur Indizes getauscht.

-- DropIndex
DROP INDEX "Order_orderNo_key";

-- CreateIndex
CREATE UNIQUE INDEX "Order_tenantId_orderNo_key" ON "Order"("tenantId", "orderNo");
