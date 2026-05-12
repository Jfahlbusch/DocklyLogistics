import type { PrismaClient } from "@prisma/client";
import { generateApiKey } from "../../lib/services/api-key";

// Idempotent: only creates a key for a supplier if they don't already have an active (non-revoked) one.
export async function seedApiKeys(prisma: PrismaClient, tenantId: string): Promise<{ created: number; printed: Array<{ supplier: string; fullKey: string }> }> {
  const suppliers = await prisma.supplier.findMany({ where: { tenantId } });
  let created = 0;
  const printed: Array<{ supplier: string; fullKey: string }> = [];

  for (const s of suppliers) {
    const active = await prisma.supplierApiKey.findFirst({
      where: { tenantId, supplierId: s.id, revokedAt: null },
    });
    if (active) continue;

    const gen = generateApiKey();
    await prisma.supplierApiKey.create({
      data: {
        tenantId, supplierId: s.id, label: "Initial Demo-Key",
        prefix: gen.prefix, hash: gen.hash,
        scopes: ["orders:read", "orders:confirm"],
        createdBy: "seed",
      },
    });
    created++;
    printed.push({ supplier: s.name, fullKey: gen.fullKey });
  }
  return { created, printed };
}
