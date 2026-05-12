import { prisma } from "../lib/db/client";
import { seedArticles } from "./seed/articles";
import { seedSuppliers } from "./seed/suppliers";

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

  await prisma.$disconnect();
  console.log(`[seed] done`);
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
