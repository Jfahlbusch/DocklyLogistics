import type { PrismaClient } from "@prisma/client";
import { encryptSecret, generateWebhookSecret } from "../../lib/crypto/aes";

const DEMO_URL = "https://webhook.site/example-replace-me"; // user can edit later; the worker will retry & give up

export async function seedWebhooks(prisma: PrismaClient, tenantId: string): Promise<{ created: number }> {
  const existing = await prisma.webhook.findFirst({ where: { tenantId, url: DEMO_URL } });
  if (existing) return { created: 0 };

  const secret = generateWebhookSecret();
  await prisma.webhook.create({
    data: {
      tenantId, url: DEMO_URL,
      events: ["order.sent", "order.confirmed", "order.received", "order.cancelled"],
      active: false, // start inactive so the worker doesn't spam an invalid URL
      secretEncrypted: encryptSecret(secret),
      description: "Demo-Webhook (deaktiviert) — Secret im Seed-Log",
      createdBy: "seed",
    },
  });
  console.log(`         webhook secret (demo): ${secret}`);
  return { created: 1 };
}
