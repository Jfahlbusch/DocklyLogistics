import { prisma } from "../lib/db/client";

async function main() {
  const result = await prisma.$queryRaw`SELECT 1 as ok`;
  console.log("DB OK:", result);

  const counts = {
    tenants: await prisma.tenant.count(),
    users: await prisma.user.count(),
    articles: await prisma.article.count(),
    suppliers: await prisma.supplier.count(),
    locations: await prisma.storageLocation.count(),
    channelConfigs: await prisma.tenantChannelConfig.count(),
    auditLogs: await prisma.auditLog.count(),
    stockBalances: await prisma.stockBalance.count(),
    stockMovements: await prisma.stockMovement.count(),
    orderSuggestions: await prisma.orderSuggestion.count(),
    orders: await prisma.order.count(),
    orderItems: await prisma.orderItem.count(),
    orderEvents: await prisma.orderEvent.count(),
  };
  console.log("Counts:", counts);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
