import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { tenantChannelRepo } from "@/lib/db/repos/tenant-channel";
import { webhookRepo } from "@/lib/db/repos/webhook";
import { SettingsView } from "./settings-view";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.role || !session.tenant) redirect("/login");

  const tenantId = session.tenant;
  const [{ items: channels }, webhooks] = await Promise.all([
    tenantChannelRepo.list({ tenantId, page: 1, pageSize: 200 }),
    webhookRepo.list(tenantId),
  ]);

  return (
    <SettingsView
      tenant={tenantId}
      role={session.role}
      keycloak={{
        clientId: process.env.KEYCLOAK_CLIENT_ID ?? "—",
        realm: process.env.KEYCLOAK_REALM ?? "—",
        url: process.env.KEYCLOAK_URL ?? "—",
      }}
      channels={channels.map((c) => ({
        id: c.id,
        channel: c.channel,
        label: c.label ?? "(ohne Label)",
        isDefault: c.isDefault,
        active: c.active,
        config: c.config as Record<string, unknown>,
        updatedAt: c.updatedAt.toISOString(),
      }))}
      webhooks={webhooks.map((w) => ({
        id: w.id,
        url: w.url,
        events: w.events,
        active: w.active,
        description: w.description,
        lastDeliveredAt: w.lastDeliveredAt?.toISOString() ?? null,
        createdAt: w.createdAt.toISOString(),
      }))}
    />
  );
}
