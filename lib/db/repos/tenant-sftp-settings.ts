import { prisma } from "@/lib/db/client";
import { encryptSecret } from "@/lib/crypto/aes";

export type SftpSettingsInput = {
  host: string;
  port?: number;
  username: string;
  authType: "KEY" | "PASSWORD";
  privateKey?: string | null; // plaintext in; stored encrypted
  password?: string | null;
  hostKeyFingerprint?: string | null;
  outboxDir?: string;
  inboxDir?: string;
  inboxFormat?: "XML" | "EDIFACT";
  routing?: "FILE" | "SUBFOLDER";
  active?: boolean;
  autoSend?: boolean;
};

export const tenantSftpSettingsRepo = {
  get(tenantId: string) {
    return prisma.tenantSftpSettings.findUnique({ where: { tenantId } });
  },

  /** Tenants whose outbox should be polled by the cron. */
  listActiveAutoSend() {
    return prisma.tenantSftpSettings.findMany({ where: { active: true, autoSend: true } });
  },

  async upsert(tenantId: string, input: SftpSettingsInput) {
    const enc: Record<string, string | null> = {};
    if (input.authType === "KEY") {
      if (input.privateKey) enc.privateKeyEncrypted = encryptSecret(input.privateKey);
      enc.passwordEncrypted = null;
    } else {
      if (input.password) enc.passwordEncrypted = encryptSecret(input.password);
      enc.privateKeyEncrypted = null;
    }
    const base = {
      host: input.host,
      port: input.port ?? 22,
      username: input.username,
      authType: input.authType,
      hostKeyFingerprint: input.hostKeyFingerprint ?? null,
      outboxDir: input.outboxDir ?? "/outbox",
      inboxDir: input.inboxDir ?? "/inbox",
      inboxFormat: input.inboxFormat ?? "XML",
      routing: input.routing ?? "FILE",
      active: input.active ?? true,
      autoSend: input.autoSend ?? true,
    };
    return prisma.tenantSftpSettings.upsert({
      where: { tenantId },
      // Only overwrite a secret when a new one was supplied (empty = keep).
      update: {
        ...base,
        ...(enc.privateKeyEncrypted !== undefined && (input.privateKey || input.authType === "PASSWORD")
          ? { privateKeyEncrypted: enc.privateKeyEncrypted }
          : {}),
        ...(enc.passwordEncrypted !== undefined && (input.password || input.authType === "KEY")
          ? { passwordEncrypted: enc.passwordEncrypted }
          : {}),
      },
      create: {
        tenantId,
        ...base,
        privateKeyEncrypted: enc.privateKeyEncrypted ?? null,
        passwordEncrypted: enc.passwordEncrypted ?? null,
      },
    });
  },

  setPollResult(tenantId: string, error: string | null) {
    return prisma.tenantSftpSettings.update({
      where: { tenantId },
      data: { lastPolledAt: new Date(), lastPollError: error },
    });
  },
};
