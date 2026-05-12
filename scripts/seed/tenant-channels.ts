import type { PrismaClient } from "@prisma/client";

const PROFILES = [
  {
    channel: "EMAIL" as const,
    label: "Hauptmailbox",
    isDefault: true,
    active: true,
    config: {
      fromEmail: "orders@docklylogistics.demo",
      fromName: "DocklyLogistics Demo-Bäckerei",
      replyTo: "einkauf@docklylogistics.demo",
      signature: "Mit freundlichen Grüßen\nDocklyLogistics Demo-Bäckerei",
    },
  },
  {
    channel: "API" as const,
    label: "Standard API-Identität",
    isDefault: true,
    active: true,
    config: {
      defaultClientId: "demo-tenant",
      defaultHeaders: { "X-Tenant-Id": "demo" },
      callbackUrl: "https://docklylogistics.demo/api/public/v1/webhooks/inbound",
    },
  },
  {
    channel: "EDI" as const,
    label: "EDIFACT Hannover",
    isDefault: true,
    active: true,
    config: {
      senderId: "4012345000019",
      senderQualifier: "14",
      edifactVersion: "D.96A",
      sftp: {
        host: "sftp.demo.local",
        port: 22,
        user: "docklylogistics",
        keyOrPassword: "demo-key-placeholder",
        remotePath: "/orders/outbound/",
      },
      encoding: "UTF-8",
    },
  },
];

export async function seedTenantChannels(prisma: PrismaClient, tenantId: string): Promise<number> {
  for (const p of PROFILES) {
    // Clear the existing default for this (tenant, channel) before upsert if our seed entry is also default.
    if (p.isDefault) {
      await prisma.tenantChannelConfig.updateMany({
        where: { tenantId, channel: p.channel, isDefault: true, NOT: { label: p.label } },
        data: { isDefault: false },
      });
    }
    await prisma.tenantChannelConfig.upsert({
      where: {
        tenantId_channel_label: { tenantId, channel: p.channel, label: p.label },
      },
      update: {
        active: p.active, isDefault: p.isDefault,
        config: p.config,
      },
      create: {
        tenantId, channel: p.channel, label: p.label,
        active: p.active, isDefault: p.isDefault, config: p.config,
      },
    });
  }
  return PROFILES.length;
}
