import { prisma } from "../lib/db/client";
import { seedArticles } from "./seed/articles";
import { seedSuppliers } from "./seed/suppliers";
import { seedTenantChannels } from "./seed/tenant-channels";
import { seedStorageLocations } from "./seed/storage-locations";
import { seedStock } from "./seed/stock";
import { seedOrderSuggestions } from "./seed/order-suggestions";

async function main() {
  const tenantId = process.env.NEXT_PUBLIC_APP_TENANT;
  if (!tenantId) {
    throw new Error("NEXT_PUBLIC_APP_TENANT not set — please source .env.local first");
  }

  console.log(`[seed] tenant: ${tenantId}`);

  // Ensure the Tenant row exists (used as foreign key target by future domains).
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: { name: tenantId },
    create: { id: tenantId, name: tenantId },
  });
  console.log(`[seed] tenant row upserted`);

  const articleCount = await seedArticles(prisma, tenantId);
  console.log(`[seed] articles: ${articleCount}`);

  const supplierResult = await seedSuppliers(prisma, tenantId);
  console.log(`[seed] suppliers: ${supplierResult.suppliers}, article-supplier links: ${supplierResult.links}`);

  const channelCount = await seedTenantChannels(prisma, tenantId);
  console.log(`[seed] tenant-channels: ${channelCount}`);

  const locResult = await seedStorageLocations(prisma, tenantId);
  console.log(`[seed] storage-locations: ${locResult.locations}, article-default-location assignments: ${locResult.assigned}`);

  const stockResult = await seedStock(prisma, tenantId);
  console.log(`[seed] stock-balances: ${stockResult.balances}, initial-movements: ${stockResult.movements}`);

  const suggestionResult = await seedOrderSuggestions(prisma, tenantId);
  console.log(`[seed] auto-suggestions created: ${suggestionResult.created}, already-pending: ${suggestionResult.skippedAlreadyPending}`);

  await prisma.$disconnect();
  console.log(`[seed] done`);
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
