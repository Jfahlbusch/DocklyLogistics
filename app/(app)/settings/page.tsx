import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { tenantChannelRepo } from "@/lib/db/repos/tenant-channel";
import { SettingsView } from "./settings-view";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.role || !session.tenant) redirect("/login");

  const { items } = await tenantChannelRepo.list({
    tenantId: session.tenant,
    page: 1,
    pageSize: 200,
  });

  const channels = items.map((c) => ({
    id: c.id,
    channel: c.channel,
    label: c.label ?? "(ohne Label)",
    isDefault: c.isDefault,
    active: c.active,
    config: c.config as Record<string, unknown>,
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <SettingsView
      tenant={session.tenant}
      role={session.role}
      channels={channels}
    />
  );
}
